#!/usr/bin/env node
/*
 * Renders the project film: frames from capture.mjs + voice-over from generate-voiceover.mjs → MP4.
 *
 *   node docs/video/film/render.mjs [frames-dir]            # default docs/video/film/kadry
 *   node docs/video/film/render.mjs --preview 12.5 40 …     # PNG stills at given seconds (layout check)
 *
 * Captions („Plansza”) come from docs/05_film_prezentacja.md; timing from lektor/slowa.json (word timestamps), so
 * subtitles and effects land on the narrator's words. The shot plan is the PLAN table below.
 * Every frame is drawn in Chrome (montage.html, canvas) and piped into ffmpeg together with the voice-over; the
 * subtitles are burned in and also written as a separate .srt file.
 * Needs Chrome with --remote-debugging-port=9333 and ffmpeg (libx264) in PATH.
 */
import { spawn, spawnSync } from 'node:child_process';
import { createReadStream, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect } from './cdp.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const VIDEO = resolve(HERE, '..');
const ROOT = resolve(VIDEO, '../..');
const args = process.argv.slice(2);
const previewAt = args[0] === '--preview' ? args.slice(1).map(Number) : null;
const FRAMES = resolve(previewAt || args[0]?.startsWith('--') ? join(HERE, 'kadry') : (args[0] ?? join(HERE, 'kadry')));
const OUT = join(VIDEO, 'kompas-kompetencji-film.mp4');
const SRT = join(VIDEO, 'kompas-kompetencji-film.srt');
const FPS = 30;
const GAP = 0.5; // silence added between scenes — a breath for the viewer
const TAIL = 2.5; // seconds of end card after the narration

/*
 * Shot plan. Each scene is 1–3 shots; `fx` names the director function in montage.html, `img` the frames it uses.
 * Times are cues on the narration: 'słowo' (first word of the scene starting with it, case- and punctuation-
 * insensitive), ['słowo', offset] or a number = seconds after the scene start. `at` = when the shot starts, `cues` =
 * moments of its effects, `trans` = transition into the shot (default cross-fade), `hud` = process indicator.
 */
const KACZMAREK = { who: 'Agnieszka Kaczmarek', sheet: 'Arkusz C' };
const PLAN = {
  '01': [{ fx: 'intro', at: 0, cues: { ustawa: 'ustawa', dwa: 'dwa', arkusze: 'arkusze', terminy: 'terminy', lost: ['kompetencje', -0.1] } }],
  '02': [
    { fx: 'jury', img: ['s2-jury'], at: 0, trans: 'iris', irisAt: [960, 470], cues: { click: ['przełożonego', 0.1] } },
    { fx: 'tour', img: ['s2-tour'], at: ['przełożonego', 0.55], trans: 'from-click', cues: { lift: ['krok', 0.1], words: 'system', w1: 'podpowiada', w2: 'pilnuje', w3: 'wybiera' } },
  ],
  '03': [
    { fx: 'scan', img: ['s3-osp-parsed'], at: 0, trans: 'push-left', hud: { who: 'Michał Wójcik', step: 0 }, cues: { drop: ['wgrywasz', -0.35] } },
    { fx: 'sheet', img: ['s3-osp-form'], at: ['wskazuje', -0.45], hud: { who: 'Michał Wójcik', step: 0 }, cues: { fly: ['albo', -0.2] } },
    { fx: 'aiCriteria', img: ['s3-osp-ai'], at: ['asystent', 0.25], hud: { who: 'Michał Wójcik', step: 0, sheet: 'Arkusz C' }, cues: { click: ['uzasadniając', 0.1] } },
  ],
  '04': [
    { fx: 'indicators', img: ['s4-score-pre', 's4-score'], at: 0, trans: 'slide-up', hud: { ...KACZMAREK, step: 2 }, cues: { loupe: ['zaznaczasz', -0.3], pan: ['system', -0.4], click: ['sugestię', 0.3] } },
    { fx: 'deadline', img: ['s4-deadline'], at: ['terminy', -0.35], hud: { who: 'Michał Wójcik', step: 1, sheet: 'Arkusz C' }, cues: { lift: ['ustawowe', -0.1] } },
  ],
  '05': [
    { fx: 'formula', img: ['s5-result-positive'], at: 0, trans: 'blur', hud: { ...KACZMAREK, step: 3 }, cues: { fill: 0.5, flip: ['ponad', -0.1], one: ['jeden', 0], stamp: ['negatywna', -0.2] } },
    { fx: 'result', img: ['s5-result-negative'], at: ['aplikacja', -0.3], hud: { ...KACZMAREK, step: 3 }, cues: { lift: ['wie', 0] } },
  ],
  '06': [
    { fx: 'ask', img: ['s6-answer'], at: 0, trans: 'iris', irisAt: [1430, 640], cues: { land: ['asystent', -0.1], mark: ['cytatem', -0.2] } },
    { fx: 'refuse', img: ['s6-refusal'], at: ['gdy', -0.45], cues: { search: ['czegoś', 0], shake: ['wiem', -0.35] } },
  ],
  '07': [
    { fx: 'draft', img: ['s7-open', 's7-draft'], at: 0, trans: 'flip', hud: { ...KACZMAREK, step: 3 }, cues: { chip: ['szkic', -0.2], insert: ['trafi', 0] } },
    { fx: 'inserted', img: ['s7-inserted'], at: ['trafi', 0.45], hud: { ...KACZMAREK, step: 3 } },
    { fx: 'pdf', img: ['s7-pdf-1', 's7-pdf-2', 's7-pdf-3'], at: ['koniec', -0.25], hud: { who: 'Krzysztof Szymański', sheet: 'Arkusz B', step: 4 }, cues: { front: ['zgodny', 0] } },
  ],
  '08': [
    { fx: 'hr', img: ['s8-hr'], at: 0, trans: 'wipe', hud: { who: 'Joanna Dąbrowska', path: 'kadry (HR)', step: -1 }, cues: { sweep: ['statusy', -0.1], click: ['ocen', 0.15] } },
    { fx: 'remind', img: ['s8-reminder'], at: ['ocen', 0.5], trans: 'from-click', hud: { who: 'Joanna Dąbrowska', path: 'kadry (HR)', step: -1 }, cues: { click: ['wysyłają', 0] } },
    { fx: 'sent', img: ['s8-sent'], at: ['wysyłają', 0.4], hud: { who: 'Joanna Dąbrowska', path: 'kadry (HR)', step: -1 }, cues: { redact: ['treści', -0.3], bars: ['nie', 0], lock: ['wcale', 0], rodo: ['rodo', -0.3] } },
  ],
  '09': [
    { fx: 'stack', img: ['s9-light', 's9-dark'], at: 0, trans: 'zoom-out', cues: { roles: 'role', offices: 'urzędów', a11y: 'dostępność', gemini: 'dziś', local: ['urzędzie', -0.1] } },
    { fx: 'end', at: ['kompas', -0.35], trans: 'zoom-through', cues: { l1: 'przepisów', l2: 'decyzję' } },
  ],
};

// ── timeline from the script and the word timings of the voice-over ─────────────────────────────────────────
const md = readFileSync(join(ROOT, 'docs/05_film_prezentacja.md'), 'utf8');
const captions = Object.fromEntries(
  [...md.matchAll(/### Scena (\d+) —[\s\S]*?\*\*Plansza:\*\* „([^”]+)”/g)].map((m) => [m[1].padStart(2, '0'), m[2]]),
);
const voice = JSON.parse(readFileSync(join(VIDEO, 'lektor/slowa.json'), 'utf8'));
const boxes = JSON.parse(readFileSync(join(FRAMES, 'boxes.json'), 'utf8'));
// fallbacks for elements the capture could not find
boxes['s3-osp-parsed'].upload ??= [1230, 395, 290, 50];
const norm = (w) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

// each scene is shifted by GAP × index; the audio is re-assembled the same way below
const audioEnd = voice.at(-1).end;
const scenes = voice.map((v, i) => {
  const shift = i * GAP;
  const words = v.words.map((w) => ({ ...w, start: w.start + shift, end: w.end + shift }));
  const start = v.start + shift;
  const end = i + 1 < voice.length ? voice[i + 1].start + (i + 1) * GAP : audioEnd + shift + TAIL;
  // subtitles: sentences with the exact spoken span of their words
  const sentences = [];
  let cur = [];
  words.forEach((w, k) => {
    cur.push(w);
    const nextW = words[k + 1];
    if (!nextW || (/[.?!…]$/.test(w.w) && /^[A-ZĄĆĘŁŃÓŚŹŻ]/.test(nextW.w))) {
      sentences.push({ text: cur.map((x) => x.w).join(' '), start: cur[0].start, end: nextW ? nextW.start - 0.05 : Math.min(end, cur.at(-1).end + 1.2) });
      cur = [];
    }
  });
  return { id: v.id, start, end, words, caption: captions[v.id] ?? '', sentences };
});
const duration = scenes.at(-1).end;

function cue(scene, spec) {
  if (typeof spec === 'number') return scene.start + spec;
  const [word, off = 0] = Array.isArray(spec) ? spec : [spec];
  if (typeof word === 'number') return scene.start + word + off;
  const w = scene.words.find((x) => norm(x.w).startsWith(norm(word)));
  if (!w) throw new Error(`Scena ${scene.id}: brak słowa „${word}” w tekście lektora`);
  return w.start + off;
}
const shots = scenes.flatMap((scene) => {
  const plan = PLAN[scene.id];
  if (!plan) throw new Error(`Brak planu ujęć dla sceny ${scene.id}`);
  return plan.map((p, k) => {
    for (const n of p.img ?? []) if (!existsSync(join(FRAMES, `${n}.png`))) throw new Error(`Brak kadru ${n}.png w ${FRAMES} — uruchom capture.mjs`);
    const start = k === 0 ? scene.start : cue(scene, p.at);
    const next = plan[k + 1];
    return {
      fx: p.fx, scene: scene.id, img: p.img, trans: p.trans, irisAt: p.irisAt, hud: p.hud, start,
      end: next ? cue(scene, next.at) : scene.end,
      cues: Object.fromEntries(Object.entries(p.cues ?? {}).map(([k2, v]) => [k2, cue(scene, v)])),
    };
  });
});
const film = { duration, scenes, shots, boxes };
if (args[0] === '--plan') {
  for (const s of shots) console.log(`${s.scene} ${s.fx.padEnd(11)} ${s.start.toFixed(2)}–${s.end.toFixed(2)}  ${Object.entries(s.cues).map(([k, v]) => `${k}@${v.toFixed(2)}`).join(' ')}`);
  console.log(`razem ${duration.toFixed(2)} s`);
  process.exit(0);
}

// ── tiny static server for the montage page, frames and audio ────────────────────────────────────────────────
const TYPES = { '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.mp3': 'audio/mpeg' };
const server = createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = url === '/' ? join(HERE, 'montage.html') : url.startsWith('/kadry/') ? join(FRAMES, url.slice(7)) : url.startsWith('/lektor/') ? join(VIDEO, 'lektor', url.slice(8)) : null;
  if (!file || !existsSync(file)) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Content-Length': statSync(file).size });
  createReadStream(file).pipe(res);
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}`;

const c = await connect({ width: 960, height: 540, scale: 1 });
await c.goto(base + '/', 2500);
await c.ev(`window.FILM = ${JSON.stringify(film)}; true`);

if (previewAt) {
  for (const t of previewAt) {
    await c.ev(`preview(${t})`);
    const data = await c.ev(`document.getElementById('c').toDataURL('image/png')`);
    const file = join(VIDEO, `.preview-${t}.png`);
    writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'));
    console.log('podgląd:', file);
  }
} else {
  // subtitles as a separate SRT file (the same text is burned into the picture)
  const ts = (t) => {
    const ms = Math.round(t * 1000);
    const p = (n, w = 2) => String(n).padStart(w, '0');
    return `${p(Math.floor(ms / 3_600_000))}:${p(Math.floor(ms / 60_000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
  };
  const subs = scenes.flatMap((s) => s.sentences);
  writeFileSync(SRT, subs.map((s, i) => `${i + 1}\n${ts(s.start)} --> ${ts(s.end)}\n${s.text}\n`).join('\n'));

  // voice-over cut at scene boundaries, GAP seconds of silence between scenes. The cut goes into the middle of the
  // real pause in the recording: the character timestamps put a scene's first letter slightly after the voice
  // actually starts, and cutting there clips the first sound before the added pause.
  const mp3 = join(VIDEO, 'lektor/lektor.mp3');
  const det = spawnSync('ffmpeg', ['-hide_banner', '-i', mp3, '-af', 'silencedetect=n=-45dB:d=0.08', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
  const silences = [...det.matchAll(/silence_start: ([\d.]+)[\s\S]*?silence_end: ([\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
  const cuts = voice.slice(1).map((v, k) => {
    const prevEnd = voice[k].words.at(-1).end, nextStart = v.words[0].start;
    const [a, b] = silences.filter(([x, y]) => y > prevEnd - 0.3 && x < nextStart + 0.3).sort((p, q) => q[1] - q[0] - (p[1] - p[0]))[0] ?? [prevEnd, nextStart];
    return +((a + b) / 2).toFixed(3);
  });
  const audioFilter =
    voice.map((_, i) => `[1:a]atrim=start=${i ? cuts[i - 1] : 0}${i < cuts.length ? `:end=${cuts[i]}` : ''},asetpts=PTS-STARTPTS${i < cuts.length ? `,apad=pad_dur=${GAP}` : ''}[s${i}]`).join(';') +
    ';' + voice.map((_, i) => `[s${i}]`).join('') + `concat=n=${voice.length}:v=0:a=1[a]`;
  console.log('Cięcia lektora (środek pauzy):', cuts.join(', '));
  const frames = Math.ceil(duration * FPS);
  console.log(`Montaż: ${frames} klatek (${duration.toFixed(1)} s, ${FPS} kl./s)…`);
  const ff = spawn('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-i', join(VIDEO, 'lektor/lektor.mp3'),
    '-filter_complex', audioFilter,
    '-map', '0:v', '-map', '[a]',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(FPS),
    '-c:a', 'aac', '-b:a', '192k',
    '-metadata', 'title=Kompas Kompetencji — prezentacja projektu (HackNation 2026)',
    '-movflags', '+faststart',
    OUT,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const finished = new Promise((ok, fail) => ff.on('close', (code) => (code === 0 ? ok() : fail(new Error(`ffmpeg zakończył się kodem ${code}`)))));
  const t0 = Date.now();
  for (let i = 0; i < frames; i++) {
    const url = await c.ev(`frameAt(${i / FPS})`);
    const buf = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
    if (!ff.stdin.write(buf)) await new Promise((ok) => ff.stdin.once('drain', ok));
    if (i % (FPS * 10) === 0) console.log(`  ${(i / FPS).toFixed(0)} s / ${duration.toFixed(0)} s  (${((Date.now() - t0) / 1000).toFixed(0)} s pracy)`);
  }
  ff.stdin.end();
  await finished;
  console.log(`Gotowe: ${OUT} (${(statSync(OUT).size / 1e6).toFixed(1)} MB), napisy: ${SRT}`);
}
if (c.errors.length) console.log('Błędy strony:\n' + c.errors.join('\n'));
c.close();
server.close();
