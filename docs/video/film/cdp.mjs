/*
 * Minimal Chrome DevTools Protocol client for the film tooling (no dependencies).
 * Needs Chrome started with --remote-debugging-port (default 9333, env CDP_PORT).
 */
import { writeFileSync } from 'node:fs';

export async function connect({ port = process.env.CDP_PORT ?? 9333, width = 1600, height = 900, scale = 1.2 } = {}) {
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const tab = tabs.find((t) => t.type === 'page');
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const errors = [];
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) {
      pending.get(d.id)(d);
      pending.delete(d.id);
    }
    if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description?.slice(0, 300));
  };
  await new Promise((r) => (ws.onopen = r));
  const send = (method, params = {}) =>
    new Promise((r) => {
      const i = ++id;
      pending.set(i, r);
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  const ev = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
    if (r.result?.exceptionDetails) throw new Error(`eval failed: ${r.result.exceptionDetails.exception?.description ?? expression.slice(0, 120)}`);
    return r.result?.result?.value;
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: false });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }, { name: 'prefers-reduced-motion', value: 'no-preference' }] });

  const api = {
    send,
    ev,
    sleep,
    errors,
    close: () => ws.close(),
    async goto(url, wait = 2500) {
      await send('Page.navigate', { url });
      await sleep(wait);
    },
    /** Click the first visible button/link/tab whose text starts with `text` (or whose aria-label equals it). */
    async click(text, { exact = false, within = 'document', last = false } = {}) {
      const ok = await ev(`(()=>{const t=${JSON.stringify(text)};const els=[...${within}.querySelectorAll('button,a,[role=tab],[role=option],label,summary')].filter(e=>e.getClientRects().length&&!e.closest('[inert]'));
        const m=(e)=>{const s=e.innerText.trim().replace(/\\s+/g,' ');return (${exact}?s===t:s.startsWith(t))||e.getAttribute('aria-label')===t};
        const list=els.filter(m); const b=${last}?list.at(-1):list[0]; if(!b) return false;
        b.scrollIntoView({block:'center'}); b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); b.dispatchEvent(new MouseEvent('mousedown',{bubbles:true})); b.click(); return true})()`);
      if (!ok) throw new Error(`click: nie znaleziono „${text}”`);
      await sleep(500);
    },
    async type(selector, value) {
      await ev(`(()=>{const i=document.querySelector(${JSON.stringify(selector)});const proto=i instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto,'value').set.call(i,${JSON.stringify(value)});i.dispatchEvent(new Event('input',{bubbles:true}));i.focus()})()`);
      await sleep(200);
    },
    async waitFor(expr, timeout = 60000) {
      const t0 = Date.now();
      while (Date.now() - t0 < timeout) {
        if (await ev(`!!(${expr})`)) return true;
        await sleep(400);
      }
      throw new Error(`waitFor timeout: ${expr}`);
    },
    async text(selector = 'main') {
      return ev(`(document.querySelector(${JSON.stringify(selector)})?.innerText??'').replace(/\\n+/g,' | ')`);
    },
    async shot(file) {
      await ev(`document.activeElement?.blur?.()`).catch(() => {});
      // the emulator hint is a dev-only artefact — keep it out of the film
      await ev(`[...document.querySelectorAll('.hint')].filter(e=>e.innerText.includes('emulatora')).forEach(e=>e.style.visibility='hidden')`);
      await sleep(250);
      const r = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(file, Buffer.from(r.result.data, 'base64'));
    },
    /** Sign out (if signed in) and enter through „Wejście dla jury” as the given role button. */
    async juryLogin(base, role) {
      await api.goto(base + '/');
      await ev(`localStorage.setItem('kompas-theme','light')`);
      if (await ev(`[...document.querySelectorAll('button')].some(b=>b.innerText.trim()==='Wyloguj')`)) {
        await api.click('Wyloguj', { exact: true });
        await sleep(2000);
      }
      await api.goto(base + '/');
      await api.click('Wejście dla jury');
      await api.click(role);
      await sleep(3500);
    },
    async emailLogin(base, email, password) {
      await api.goto(base + '/');
      await ev(`localStorage.setItem('kompas-theme','light')`);
      if (await ev(`[...document.querySelectorAll('button')].some(b=>b.innerText.trim()==='Wyloguj')`)) {
        await api.click('Wyloguj', { exact: true });
        await sleep(2000);
      }
      await api.goto(base + '/');
      await api.click('E-mail i hasło');
      await api.type('#email', email);
      await api.type('#password', password);
      await ev(`document.querySelector('#password').form.requestSubmit()`);
      await sleep(3500);
    },
  };
  return api;
}
