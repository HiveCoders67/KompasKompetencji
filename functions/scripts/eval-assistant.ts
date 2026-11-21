/*
 * Live run of the assistant test set (docs/03 § 2.A „Zestaw testów asystenta”) against the configured model (LLM_MODEL, default gemini-3.5-flash-lite).
 * Run after every change of the prompt or the index:
 *   GEMINI_API_KEY=… npm run eval:assistant -w functions
 * Spaces calls to stay within the free-tier RPM.
 */
import testset from '../src/rag/testset.json';
import { DEFAULT_MODEL, GeminiProvider, LlmQuotaError } from '../src/llm';
import { answerFormal } from '../src/rag/formal';

const key = process.env.GEMINI_API_KEY;
if (!key) {
  console.error('Ustaw GEMINI_API_KEY.');
  process.exit(2);
}
const llm = new GeminiProvider(key, process.env.LLM_MODEL ?? DEFAULT_MODEL);
// Each prompt is ~3–4k tokens; the free tier limits tokens per minute, so calls are spaced generously.
const DELAY_MS = Number(process.env.EVAL_DELAY_MS ?? 20000);
const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

async function ask(question: string, ctx: Parameters<typeof answerFormal>[2]) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await answerFormal(llm, question, ctx);
    } catch (e) {
      if (e instanceof LlmQuotaError && attempt < 4) {
        console.log(`  … limit (429), czekam 65 s (próba ${attempt}/3)`);
        await sleep(65000);
        continue;
      }
      throw e;
    }
  }
}

let failed = 0;
for (const tc of testset.cases) {
  const ctx = tc.path ? { path: tc.path as 'A' | 'B', formType: null, step: null, status: null } : null;
  let r: Awaited<ReturnType<typeof answerFormal>>;
  try {
    r = await ask(tc.question, ctx);
  } catch (e) {
    failed++;
    console.log(`FAIL ${tc.id} (błąd API: ${e instanceof Error ? e.message : String(e)})`);
    await sleep(DELAY_MS);
    continue;
  }
  let ok: boolean;
  if (tc.refuse) ok = r.refused;
  else {
    const cited = r.citations.some((c) => (tc.units as [string, string | null][]).some(([s, u]) => c.source === s && (u === null || c.unit?.startsWith(u))));
    ok = !r.refused && (!tc.expect || r.content.toUpperCase().includes(tc.expect.toUpperCase())) && (cited || r.citations.length > 0);
  }
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${tc.id}${r.debug.reason ? ` (${r.debug.reason})` : ''}\n  ${r.content.replace(/\n/g, ' ').slice(0, 300)}\n  ${r.citations.map((c) => `${c.source} ${c.unit ?? ''} s.${c.page ?? '—'}`).join(' | ')}`);
  await sleep(DELAY_MS);
}
console.log(`\n${testset.cases.length - failed}/${testset.cases.length} OK`);
process.exit(failed ? 1 : 0);
