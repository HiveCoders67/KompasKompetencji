#!/usr/bin/env node
/*
 * Captures every frame of the project film (docs/05_film_prezentacja.md) from the running app.
 *
 * Prerequisites (local only — the script RESETS the demo data, so never point it at production):
 *   npm run emulators                                        # Firebase emulators
 *   VITE_FIREBASE_USE_EMULATOR=true npm run dev              # app on http://localhost:5173
 *   Chrome with --remote-debugging-port=9333 (headless is fine)
 *
 *   node docs/video/film/capture.mjs <out-dir>
 *
 * Besides the PNGs it writes boxes.json: for each shot, named on-screen boxes (screenshot pixels) of the elements the
 * montage animates — the button the cursor clicks, the citation it marks, the card it lifts out, etc. The AI frames
 * call the real assistant (Gemini).
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect } from './cdp.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../..');
const OUT = resolve(process.argv[2] ?? join(HERE, 'kadry'));
const BASE = process.env.APP_URL ?? 'http://localhost:5173';
if (!/localhost|127\.0\.0\.1/.test(BASE)) throw new Error('capture.mjs resetuje dane demo — uruchamiaj tylko na lokalnym emulatorze.');
mkdirSync(OUT, { recursive: true });

const c = await connect();
const boxes = {};
/**
 * Screenshot + the boxes of the elements the montage animates. `targets` maps a name to a JS expression returning an
 * Element; boxes are stored in screenshot pixels (CSS px × devicePixelRatio), padded and clipped to the viewport.
 */
async function shot(name, targets = {}) {
  const found = {};
  for (const [key, target] of Object.entries(targets)) {
    const box = await c.ev(`(()=>{const el=(${target}); if(!el) return null; const r=el.getBoundingClientRect(), d=devicePixelRatio, p=6;
      const x=Math.max(0,r.left-p), y=Math.max(0,r.top-p), x2=Math.min(innerWidth,r.right+p), y2=Math.min(innerHeight,r.bottom+p);
      return x2-x>8 && y2-y>8 ? [x*d, y*d, (x2-x)*d, (y2-y)*d].map(Math.round) : null})()`);
    if (box) found[key] = box;
    else console.log(`  ! brak elementu ${name}.${key}`);
  }
  boxes[name] = found;
  await c.shot(join(OUT, `${name}.png`));
  console.log('  ✓', name);
}
/** JS expression: the smallest visible element whose text starts with `text` and that is at least minW × minH px. */
const pick = (text, sel = '*', minH = 0, minW = 0) =>
  `[...document.querySelectorAll(${JSON.stringify(sel)})].filter(e=>{const r=e.getBoundingClientRect(); return r.height>=${minH}&&r.width>=${minW}&&r.bottom>0&&r.top<innerHeight&&e.innerText?.trim().startsWith(${JSON.stringify(text)})})
    .sort((a,b)=>{const A=a.getBoundingClientRect(),B=b.getBoundingClientRect(); return A.width*A.height-B.width*B.height})[0]`;
/** JS expression: the visible button whose text is exactly `text` (first or last match). */
const btn = (text, last = false) =>
  `[...document.querySelectorAll('button,[role=radio],[role=tab]')].filter(b=>b.getClientRects().length&&b.innerText.trim()===${JSON.stringify(text)})${last ? '.at(-1)' : '[0]'}`;
/** Scroll so that the element containing `text` (matched on headings/labels first) sits `offset` px below the top. */
const scrollToText = (text, offset = 110, sel = 'h1,h2,h3,h4,p,label,th,td,span,button,summary') =>
  c.ev(`(()=>{const el=[...document.querySelectorAll(${JSON.stringify(sel)})].find(e=>e.getClientRects().length&&e.innerText.trim().startsWith(${JSON.stringify(text)}));
    if(!el) return false; window.scrollTo({top: el.getBoundingClientRect().top + window.scrollY - ${offset}, behavior:'instant'}); return true})()`);
const radio = (group, value) =>
  c.ev(`(()=>{const g=[...document.querySelectorAll('[role=radiogroup]')].find(g=>g.getAttribute('aria-label')===${JSON.stringify(group)});
    const r=g?.querySelector('[role=radio][value="${value}"]'); if(!r) return false; r.click(); return true})()`);
const expandCriterion = (name) =>
  c.ev(`(()=>{const b=[...document.querySelectorAll('.disclosure-trigger')].find(b=>b.innerText.startsWith(${JSON.stringify(name)}));
    if(b && b.getAttribute('aria-expanded')!=='true') b.click(); return !!b})()`);
const collapseAll = () => c.ev(`[...document.querySelectorAll('.disclosure-trigger[aria-expanded=true]')].forEach(b=>b.click())`);
/** Sets every indicator of a criterion to `level` and picks `score` as the partial score. */
async function scoreCriterion(name, level, score) {
  await expandCriterion(name);
  await c.sleep(500);
  await c.ev(`(()=>{const card=[...document.querySelectorAll('.criterion-card')].find(k=>k.querySelector('.disclosure-trigger').innerText.startsWith(${JSON.stringify(name)}));
    card.querySelectorAll('[role=radiogroup][aria-label^="Zaobserwowane zachowanie"]').forEach(g=>g.querySelector('[role=radio][value="${level}"]')?.click())})()`);
  await c.sleep(300);
  await radio(`Ocena cząstkowa: ${name}`, score);
  await c.sleep(300);
}
async function setTheme(theme) {
  await c.ev(`localStorage.setItem('kompas-theme','${theme}'); document.documentElement.dataset.theme='${theme}'`);
  // reduced motion: the app's own section animations would otherwise be caught mid-way (the film animates itself)
  await c.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: 'reduce' }] });
}
/** The onboarding tour (components/Tour.tsx) would cover the screens — mark it as seen for every demo account. */
const skipTours = () =>
  c.ev(`['sup_dc','sup_dsi','sup_dwm','head_dc','head_dsi','hr_admin'].forEach(u=>localStorage.setItem('kompas.tour.v1.'+u,'done'))`);

// ── reset demo data ────────────────────────────────────────────────────────────────────────────────────────
console.log('Reset danych demo…');
await c.goto(BASE + '/');
await setTheme('light');
await skipTours();
if (await c.ev(`[...document.querySelectorAll('button')].some(b=>b.innerText.trim()==='Wyloguj')`)) {
  await c.click('Wyloguj', { exact: true });
  await c.sleep(2000);
}
await c.goto(BASE + '/');
await c.click('Wejście dla jury');
await c.click('Przywróć dane demo');
await c.click('Przywróć dane demo', { last: true });
await c.waitFor(`document.body.innerText.includes('Przywrócono.')`, 120000);

// ── scene 2: jury entry → dashboard with the onboarding tour ────────────────────────────────────────────────
console.log('Scena 2…');
await c.goto(BASE + '/');
await c.click('Wejście dla jury');
await c.sleep(600);
await shot('s2-jury', { panel: `document.querySelector('.login-panel')?.closest('.card')`, btn: pick('Przełożony', 'button') });
await c.ev(`localStorage.removeItem('kompas.tour.v1.sup_dc')`); // the tour is part of the story here
await c.click('Przełożony');
await c.sleep(4500);
await shot('s2-tour', { card: `document.querySelector('.tour-card')`, start: btn('Zaczynamy') });
await c.click('Pomiń samouczek');
await c.sleep(800);

// ── scene 3: OSP upload → sheet → AI criteria (Wójcik) ──────────────────────────────────────────────────────
console.log('Scena 3…');
await c.goto(BASE + '/oceny/ev_wojcik_2026', 1500);
await c.waitFor(`document.querySelector('input[type=file]')`, 30000);
await c.sleep(800);
const ospFile = join(ROOT, 'demo-data/osp', readdirSync(join(ROOT, 'demo-data/osp')).find((f) => f.includes('starszy-specjalista')));
const { result: root } = await c.send('DOM.getDocument', {});
const { result: input } = await c.send('DOM.querySelector', { nodeId: root.root.nodeId, selector: 'input[type=file]' });
await c.send('DOM.setFileInputFiles', { nodeId: input.nodeId, files: [ospFile] });
await c.waitFor(`document.body.innerText.includes('Zatwierdź wynik parsowania')`, 20000);
await c.sleep(800);
await shot('s3-osp-parsed', { card: pick('Opis stanowiska pracy (OSP)', 'div.card,section', 300), upload: btn('Wgraj plik OSP (DOCX)') });
await c.click('Zatwierdź wynik parsowania');
await c.sleep(2500);
await scrollToText('Dobór arkusza', 60);
await c.sleep(400);
await shot('s3-osp-form', { rule: pick('Brak podległych pracowników →', '*', 40), sheet: pick('Arkusz oceny:', 'p') });
await c.click('Zaproponuj kryteria dodatkowe (AI)');
await c.waitFor(`document.body.innerText.includes('Sugestie AI na podstawie')`, 90000);
await c.sleep(800);
await scrollToText('Kryteria oceny', 60);
await c.sleep(400);
const aiCard = `[...document.querySelectorAll('div.rounded-lg.border')].find(d=>d.querySelector('button')?.innerText.trim()==='Dodaj')`;
await shot('s3-osp-ai', { card: aiCard, add: `(${aiCard})?.querySelector('button')`, list: pick('Sugestie AI na podstawie', 'p,div,h4,h5,span') });
await c.click('Dodaj');
await c.sleep(1200);
// step 2 — statutory deadline computed for the evaluation
await c.click('Dalej: rozpocznij ocenę');
await c.sleep(2500);
await scrollToText('Termin sporządzenia oceny', 200);
await c.sleep(400);
await shot('s4-deadline', { deadline: pick('Termin sporządzenia oceny', '*', 60) });

// ── scene 6: formal assistant — citation and refusal ────────────────────────────────────────────────────────
console.log('Scena 6…');
await c.goto(BASE + '/asystent', 3000);
await c.click('Nowy pracownik został zwolniony ze służby przygotowawczej');
await c.waitFor(`!document.querySelector('[role=status]') && document.querySelectorAll('details').length > 0`, 90000);
await c.ev(`document.querySelectorAll('details').forEach((d,i)=>{ if(i===0) d.open=true })`);
await c.sleep(600);
await c.ev(`document.querySelector('details')?.scrollIntoView({block:'center'})`);
await c.sleep(400);
await shot('s6-answer', {
  q: pick('Nowy pracownik został zwolniony', '*', 20),
  answer: `document.querySelector('details')?.parentElement`,
  cite: `document.querySelector('details')`,
});
await c.type('#formal-q', 'Jaki jest wymiar urlopu na żądanie w Kodeksie pracy?');
await c.ev(`document.querySelector('#formal-q').form.requestSubmit()`);
await c.sleep(800);
await c.waitFor(`!document.querySelector('[role=status]')`, 90000);
await c.sleep(1000);
await c.ev(`window.scrollTo(0, document.body.scrollHeight)`);
await c.sleep(500);
await shot('s6-refusal', { q: pick('Jaki jest wymiar urlopu', '*', 20), refusal: pick('Brak informacji w bazie wiedzy', '*', 50) });

// ── scenes 4, 5, 7: assessment → result → interview assistant (Kaczmarek, supervisor T. Wiśniewski) ─────────
console.log('Sceny 4, 5, 7…');
await c.emailLogin(BASE, 'tomasz.wisniewski@demo.kompas.local', 'Kompas2026!');
await c.goto(BASE + '/oceny/ev_kaczmarek_2027', 1500);
await c.waitFor(`document.querySelectorAll('.criterion-card').length === 8`, 30000);
await c.sleep(1000);
await collapseAll();
await c.sleep(500);
await expandCriterion('Myślenie analityczne');
await c.sleep(900);
// one frame before and one after the supervisor picks the partial score (the montage cuts on the click)
const scoreGroup = `[...document.querySelectorAll('[role=radiogroup]')].find(g=>g.getAttribute('aria-label')==='Ocena cząstkowa: Myślenie analityczne')`;
await c.ev(`(()=>{const b=(${scoreGroup}).closest('.rounded-lg'); window.scrollTo({top:b.getBoundingClientRect().top+window.scrollY-600,behavior:'instant'})})()`);
await c.sleep(500);
const scoreTargets = {
  indicator: `document.querySelector('[role=radiogroup][aria-label^="Zaobserwowane zachowanie: Formułowanie"] [data-state=checked]')`,
  indicators: `document.querySelector('[role=radiogroup][aria-label^="Zaobserwowane zachowanie: Formułowanie"]')`,
  score: `(${scoreGroup})?.closest('.rounded-lg')`,
  pill: `(${scoreGroup})?.querySelector('[role=radio][value="7"]')`,
};
await shot('s4-score-pre', scoreTargets);
await radio('Ocena cząstkowa: Myślenie analityczne', 7);
await c.sleep(800);
await shot('s4-score', scoreTargets);
await collapseAll();
for (const [name, level, score] of [
  ['Organizacja pracy i orientacja na osiąganie celów', 7, 7],
  ['Współpraca', 7, 7],
  ['Komunikacja', 7, 7],
  ['Kreatywność', 5, 5],
  ['Podejmowanie decyzji i odpowiedzialność', 7, 7],
]) {
  await scoreCriterion(name, level, score);
}
await c.sleep(1500);
await c.click('4. Rozmowa oceniająca');
await c.sleep(2000);
await scrollToText('Średnia arytmetyczna', 380, 'td,th,p,span,dt');
await c.sleep(400);
const resultTargets = { result: pick('Średnia arytmetyczna', '*', 50, 500), table: `document.querySelector('table')` };
await shot('s5-result-positive', resultTargets);
// one criterion at 1 point → negative despite the average (§ 11 rozp. 2016)
await c.click('3. Ocena wskaźników');
await c.sleep(1500);
await collapseAll();
await scoreCriterion('Komunikacja', 1, 1);
await c.sleep(800);
await c.click('4. Rozmowa oceniająca');
await c.sleep(2000);
await scrollToText('Średnia arytmetyczna', 380, 'td,th,p,span,dt');
await c.sleep(400);
await shot('s5-result-negative', resultTargets);
// interview assistant: draft justification → insert into the form
await c.click('Asystent AI', { exact: true });
await c.sleep(800);
await c.ev(`(()=>{const t=[...document.querySelectorAll('[role=tab]')].find(b=>b.innerText.includes('Rozmowa')); t.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); t.dispatchEvent(new MouseEvent('mousedown',{bubbles:true})); t.click()})()`);
await c.sleep(600);
await shot('s7-open', { window: `document.querySelector('#assistant-window')`, chip: btn('Szkic uzasadnienia') });
await c.click('Szkic uzasadnienia');
await c.waitFor(`[...document.querySelectorAll('button')].some(b=>b.innerText.trim()==='Wstaw do formularza')`, 90000);
await c.sleep(1200);
await shot('s7-draft', { window: `document.querySelector('#assistant-window')`, insert: btn('Wstaw do formularza') });
await c.click('Wstaw do formularza', { exact: true });
await c.sleep(1200);
await c.click('Zamknij asystenta', { exact: true });
await c.sleep(600);
await scrollToText('Uzasadnienie przyznanej oceny', 160);
await c.sleep(500);
await shot('s7-inserted', { field: `document.querySelector('textarea')`, badge: pick('Szkic wygenerowany przez AI', 'span,p,div') });

// ── scene 8: HR panel — reminder, privacy ──────────────────────────────────────────────────────────────────
console.log('Scena 8…');
await c.juryLogin(BASE, 'HR');
await c.goto(BASE + '/hr', 3500);
await shot('s8-hr', { tiles: `document.querySelector('[data-tour=hr-tiles]')`, table: `document.querySelector('table')`, remind: btn('Przypomnij') });
await c.click('Przypomnij');
await c.sleep(1000);
await shot('s8-reminder', { dialog: `document.querySelector('[role=dialog]')`, send: btn('Wyślij') });
await c.click('Wyślij', { exact: true });
await c.sleep(2500);
await shot('s8-sent', { banner: pick('Wysłano przypomnienie', '*', 30), tile: `[...document.querySelectorAll('[data-tour=hr-tiles] > *')].at(-1)` });

// ── scene 9: the same dashboard in both themes (accessibility) ──────────────────────────────────────────────
console.log('Scena 9…');
await c.juryLogin(BASE, 'Przełożony');
await c.goto(BASE + '/oceny', 3500);
await shot('s9-light');
await setTheme('dark');
await c.goto(BASE + '/oceny', 3500);
await shot('s9-dark');
await setTheme('light');
await c.goto(BASE + '/oceny', 1500);

// ── PDF: the official-form sheet of a completed evaluation (Szymański, supervisor K. Lewandowska) ───────────
console.log('PDF…');
await c.emailLogin(BASE, 'katarzyna.lewandowska@demo.kompas.local', 'Kompas2026!');
await c.goto(BASE + '/oceny/ev_szymanski_2025', 1500);
await c.waitFor(`document.body.innerText.includes('Krzysztof Szymański')`, 30000);
await c.sleep(800);
await c.click('5. Zatwierdzenie i PDF');
await c.sleep(1500);
await shot('s7-complete');
const before = new Set(readdirSync(OUT));
await c.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: OUT });
await c.click('Pobierz arkusz PDF');
let pdf;
for (let i = 0; i < 60 && !pdf; i++) {
  await c.sleep(500);
  pdf = readdirSync(OUT).find((f) => f.endsWith('.pdf') && !before.has(f));
}
if (!pdf) throw new Error('PDF nie został pobrany.');
execFileSync('swift', [join(HERE, 'pdf-to-png.swift'), join(OUT, pdf), join(OUT, 's7-pdf'), '1600'], { stdio: 'inherit' });

writeFileSync(join(OUT, 'boxes.json'), JSON.stringify(boxes, null, 2));
console.log(c.errors.length ? 'Błędy strony:\n' + c.errors.join('\n') : 'Bez błędów strony.');
c.close();
