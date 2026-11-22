#!/usr/bin/env node
/*
 * Voice-over for the project film (docs/05_film_prezentacja.md § 4) — ElevenLabs text-to-speech.
 *
 * The narration is read from docs/05_film_prezentacja.md (blocks between <!-- lektor:NN --> and <!-- /lektor -->),
 * so the document stays the single source of the text. The whole text goes out in ONE request (the intonation
 * flows across scenes like a live narrator); scene boundaries come from the character timestamps. Output:
 *   docs/video/lektor/lektor.mp3   the full voice-over
 *   docs/video/lektor/czasy.md     start / duration of every scene
 *   docs/video/lektor/slowa.json   start / end of every word (the montage syncs subtitles and effects to it)
 * and the "(m:ss–m:ss)" ranges in the scene headings of the script are rewritten to match.
 *
 * Key: ELEVENLABS_API_KEY from the environment or from .env.local in the repo root (git-ignored). Never printed.
 *
 *   node docs/video/generate-voiceover.mjs
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SCRIPT = join(ROOT, 'docs/05_film_prezentacja.md');
const OUT = join(ROOT, 'docs/video/lektor');

const VOICE_ID = process.env.ELEVENLABS_VOICE_ID ?? 'Xb7hH8MSUJpSbSDYk0k2'; // Alice — Clear, Engaging Educator
const MODEL_ID = process.env.ELEVENLABS_MODEL_ID ?? 'eleven_v4';
// lower stability → livelier, less monotonous delivery
const VOICE_SETTINGS = { stability: 0.35, similarity_boost: 0.75 };
const MAX_SECONDS = 120;
const SEPARATOR = '\n\n'; // between scenes — read as a paragraph pause

function apiKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY.trim();
  const env = join(ROOT, '.env.local');
  if (existsSync(env)) {
    const line = readFileSync(env, 'utf8')
      .split(/\r?\n/)
      .reverse()
      .find((l) => l.startsWith('ELEVENLABS_API_KEY='));
    if (line) return line.slice('ELEVENLABS_API_KEY='.length).trim().replace(/^["']|["']$/g, '');
  }
  throw new Error('Brak ELEVENLABS_API_KEY (zmienna środowiskowa albo .env.local w katalogu głównym).');
}

/** [{ id: '01', text }] in document order. */
function scenes(md) {
  const found = [...md.matchAll(/<!-- lektor:(\d+) -->\s*([\s\S]*?)\s*<!-- \/lektor -->/g)].map((m) => ({
    id: m[1],
    text: m[2].replace(/\s+/g, ' ').trim(),
  }));
  if (!found.length) throw new Error(`Nie znaleziono bloków lektora w ${SCRIPT}.`);
  return found;
}

async function synthesize(key, text) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/with-timestamps?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, model_id: MODEL_ID, voice_settings: VOICE_SETTINGS, language_code: 'pl' }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`ElevenLabs ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = await res.json();
  return { audio: Buffer.from(json.audio_base64, 'base64'), alignment: json.alignment };
}

const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

const md = readFileSync(SCRIPT, 'utf8');
const all = scenes(md);
const text = all.map((s) => s.text).join(SEPARATOR);

const key = apiKey();
mkdirSync(OUT, { recursive: true });
console.log(`Generuję lektora: ${all.length} scen, ${text.length} znaków, głos ${VOICE_ID}, model ${MODEL_ID}…`);
const { audio, alignment } = await synthesize(key, text);
writeFileSync(join(OUT, 'lektor.mp3'), audio);

// character offsets of each scene in the sent text → start / end time from the alignment
if (alignment.characters.join('') !== text) console.warn('UWAGA: znaki w znacznikach czasu różnią się od wysłanego tekstu — czasy słów mogą być przesunięte.');
const starts = alignment.character_start_times_seconds;
const ends = alignment.character_end_times_seconds;
const total = audio.length * 8 / 128_000;
let offset = 0;
const timed = all.map((s, i) => {
  const from = offset;
  const to = offset + s.text.length - 1;
  offset += s.text.length + SEPARATOR.length;
  const start = i === 0 ? 0 : starts[from] ?? 0;
  // words of the scene with their spoken time span (character alignment → first/last letter of each word)
  const words = [...s.text.matchAll(/\S+/g)].map((m) => {
    const a = from + m.index, b = Math.min(a + m[0].length - 1, ends.length - 1);
    return { w: m[0], start: +(starts[a] ?? 0).toFixed(3), end: +(ends[b] ?? 0).toFixed(3) };
  });
  return { ...s, start, words, speechEnd: ends[Math.min(to, ends.length - 1)] };
});
// a scene lasts until the next one starts (the pause belongs to the scene before it)
timed.forEach((s, i) => (s.end = i + 1 < timed.length ? timed[i + 1].start : total));

writeFileSync(
  join(OUT, 'czasy.md'),
  [
    '# Czasy nagrania lektora',
    '',
    `Plik \`lektor.mp3\`, wygenerowany skryptem \`generate-voiceover.mjs\` (model \`${MODEL_ID}\`, głos \`${VOICE_ID}\`). Czas sceny trwa do początku następnej (z pauzą).`,
    '',
    '| Scena | Od–do | Długość | Słowa |',
    '| :---: | :---: | ---: | ---: |',
    ...timed.map((s) => `| ${s.id} | ${mmss(s.start)}–${mmss(s.end)} | ${(s.end - s.start).toFixed(1)} s | ${s.text.split(' ').length} |`),
    '',
    `**Razem: ${mmss(total)}** (${total.toFixed(1)} s).`,
    '',
  ].join('\n'),
);

writeFileSync(
  join(OUT, 'slowa.json'),
  JSON.stringify(timed.map(({ id, start, end, words }) => ({ id, start: +start.toFixed(3), end: +end.toFixed(3), words })), null, 1),
);

// rewrite "### Scena N — … (m:ss–m:ss)" headings in the script
let updated = md;
timed.forEach((s) => {
  const n = Number(s.id);
  updated = updated.replace(new RegExp(`(### Scena ${n} — [^\\n]*?)\\(\\d+:\\d{2}–\\d+:\\d{2}\\)`), `$1(${mmss(s.start)}–${mmss(s.end)})`);
});
if (updated !== md) writeFileSync(SCRIPT, updated);

for (const s of timed) console.log(`  scena ${s.id}: ${mmss(s.start)}–${mmss(s.end)} (${(s.end - s.start).toFixed(1)} s)`);
console.log(`Razem ${mmss(total)} (${total.toFixed(1)} s) → docs/video/lektor/lektor.mp3`);
if (total > MAX_SECONDS) {
  console.error(`UWAGA: nagranie przekracza ${MAX_SECONDS} s — skróć tekst lektora.`);
  process.exitCode = 1;
}
