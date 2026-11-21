/*
 * Live run of the assistant test set (docs/03 § 2.A „Zestaw testów asystenta”) against Gemma 4.
 * Run after every change of the prompt or the index:
 *   GEMINI_API_KEY=… npm run eval:assistant -w functions
 * Spaces calls to stay within the free-tier RPM.
 */
import testset from '../src/rag/testset.json';
import { DEFAULT_MODEL, GemmaProvider } from '../src/llm';
import { answerFormal } from '../src/rag/formal';

const key = process.env.GEMINI_API_KEY;
if (!key) {
  console.error('Ustaw GEMINI_API_KEY.');
  process.exit(2);
}
const llm = new GemmaProvider(key, process.env.GEMMA_MODEL ?? DEFAULT_MODEL);
let failed = 0;
for (const tc of testset.cases) {
  const ctx = tc.path ? { path: tc.path as 'A' | 'B', formType: null, step: null, status: null } : null;
  const r = await answerFormal(llm, tc.question, ctx);
  let ok: boolean;
  if (tc.refuse) ok = r.refused;
  else {
    const cited = r.citations.some((c) => (tc.units as [string, string | null][]).some(([s, u]) => c.source === s && (u === null || c.unit?.startsWith(u))));
    ok = !r.refused && (!tc.expect || r.content.toUpperCase().includes(tc.expect.toUpperCase())) && (cited || r.citations.length > 0);
  }
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${tc.id}${r.debug.reason ? ` (${r.debug.reason})` : ''}\n  ${r.content.replace(/\n/g, ' ').slice(0, 300)}\n  ${r.citations.map((c) => `${c.source} ${c.unit ?? ''} s.${c.page ?? '—'}`).join(' | ')}`);
  await new Promise((res) => setTimeout(res, 2500));
}
console.log(`\n${testset.cases.length - failed}/${testset.cases.length} OK`);
process.exit(failed ? 1 : 0);
