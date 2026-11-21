/*
 * Live run of the assistant test set (docs/03 § 2.A „Zestaw testów asystenta”) against the configured Gemini model (GEMINI_MODEL, GEMINI_THINKING_LEVEL, EVAL_ONLY=id1,id2, EVAL_DELAY_MS).
 * Run after every change of the prompt or the index:
 *   GEMINI_API_KEY=… npm run eval:assistant -w functions
 * Spaces calls to stay within the free-tier RPM.
 */
import testset from '../src/rag/testset.json';
import { DEFAULT_MODEL, DEFAULT_THINKING_LEVEL, GeminiProvider, parseThinkingLevel } from '../src/llm';
import { answerFormal } from '../src/rag/formal';

const key = process.env.GEMINI_API_KEY;
if (!key) {
  console.error('Ustaw GEMINI_API_KEY.');
  process.exit(2);
}
const model = process.env.GEMINI_MODEL ?? DEFAULT_MODEL;
const thinking = parseThinkingLevel(process.env.GEMINI_THINKING_LEVEL ?? DEFAULT_THINKING_LEVEL);
const llm = new GeminiProvider(key, model, { budgetMs: 110_000, thinkingLevel: thinking });
console.log(`Model: ${model}, thinking: ${thinking ?? 'default'}\n`);
const t0 = Date.now();
let failed = 0;
const only = process.env.EVAL_ONLY?.split(',');
const cases = only ? testset.cases.filter((c) => only.includes(c.id)) : testset.cases;
for (const tc of cases) {
  const ctx = tc.path ? { path: tc.path as 'A' | 'B', formType: null, step: null, status: null } : null;
  const t = Date.now();
  const r = await answerFormal(llm, tc.question, ctx);
  const secs = ((Date.now() - t) / 1000).toFixed(1);
  let ok: boolean;
  if (tc.refuse) ok = r.refused;
  else {
    const cited = r.citations.some((c) => (tc.units as [string, string | null][]).some(([s, u]) => c.source === s && (u === null || c.unit?.startsWith(u))));
    ok = !r.refused && (!tc.expect || r.content.toUpperCase().includes(tc.expect.toUpperCase())) && (cited || r.citations.length > 0);
  }
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${tc.id} [${secs} s]${r.debug.reason ? ` (${r.debug.reason})` : ''}\n  ${r.content.replace(/\n/g, ' ').slice(0, 300)}\n  ${r.citations.map((c) => `${c.source} ${c.unit ?? ''} s.${c.page ?? '—'}`).join(' | ')}`);
  await new Promise((res) => setTimeout(res, Number(process.env.EVAL_DELAY_MS ?? 2500)));
}
console.log(`\n${cases.length - failed}/${cases.length} OK, total ${((Date.now() - t0) / 1000).toFixed(0)} s`);
process.exit(failed ? 1 : 0);
