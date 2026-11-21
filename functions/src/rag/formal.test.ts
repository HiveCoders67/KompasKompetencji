import { describe, expect, it } from 'vitest';
import type { LlmProvider } from '../llm';
import { answerFormal, REFUSAL } from './formal';
import { retrieve } from './search';

const Q = 'Ile dni ma pracownik na złożenie sprzeciwu od oceny okresowej i do kogo?';
const ctx = { path: 'B' as const, formType: 'FORM_C' as const, step: 'Rozmowa oceniająca i wynik', status: 'IN_PROGRESS' as const };

/** Fake model answering with a citation of the given fragment / unit / quote. */
function fake(build: (fragments: string) => object): LlmProvider & { prompts: string[] } {
  const prompts: string[] = [];
  return {
    name: 'fake',
    prompts,
    async generate({ user }) {
      prompts.push(user);
      return '```json\n' + JSON.stringify(build(user)) + '\n```';
    },
  };
}
const fragmentOf = (prompt: string, unit: string) => prompt.match(new RegExp(`\\[(F\\d+)\\][^\\n]*jednostka: ${unit.replace(/\./g, '\\.')} `))?.[1];

describe('Formal Assistant — grounding and citation validation', () => {
  it('accepts a citation matching retrieved metadata and quote; context goes to the prompt only', async () => {
    const llm = fake((p) => ({
      answer: '7 dni od dnia zapoznania się z oceną, do dyrektora generalnego urzędu.',
      citations: [{ fragment: fragmentOf(p, 'art. 83 ust. 1'), unit: 'art. 83 ust. 1', page: 25, quote: 'w terminie 7 dni od dnia zapoznania się z oceną' }],
    }));
    const r = await answerFormal(llm, Q, ctx);
    expect(r.refused).toBe(false);
    expect(r.citations[0]).toMatchObject({ source: 'USTAWA', unit: 'art. 83 ust. 1', page: 25 });
    expect(llm.prompts[0]).toContain('KONTEKST EKRANU: ścieżka B — ocena okresowa; arkusz: Arkusz C');
    // screen context does not change retrieval
    expect(retrieve(Q, { path: 'B' }).map((h) => h.chunk.id)).toEqual(retrieve(Q, { path: 'B' }).map((h) => h.chunk.id));
  });

  it('rejects a citation with a unit that differs from the fragment metadata', async () => {
    const llm = fake((p) => ({ answer: 'x', citations: [{ fragment: fragmentOf(p, 'art. 83 ust. 1'), unit: 'art. 84 ust. 1', page: 25 }] }));
    const r = await answerFormal(llm, Q, ctx);
    expect(r).toMatchObject({ refused: true, content: REFUSAL });
  });

  it('rejects an invented quote and a fragment that was not retrieved', async () => {
    const quote = fake((p) => ({ answer: 'x', citations: [{ fragment: fragmentOf(p, 'art. 83 ust. 1'), unit: 'art. 83 ust. 1', quote: 'w terminie 14 dni' }] }));
    expect((await answerFormal(quote, Q, ctx)).refused).toBe(true);
    const missing = fake(() => ({ answer: 'x', citations: [{ fragment: 'F99', unit: 'art. 83 ust. 1' }] }));
    expect((await answerFormal(missing, Q, ctx)).refused).toBe(true);
  });

  it('answer without citations or model-declared insufficiency → refusal', async () => {
    expect((await answerFormal(fake(() => ({ answer: 'Tak.' })), Q, ctx)).refused).toBe(true);
    expect((await answerFormal(fake(() => ({ answer: '', insufficient: true })), Q, ctx)).content).toBe(REFUSAL);
  });

  it('question with no content terms is refused without calling the model', async () => {
    const llm = fake(() => ({}));
    expect((await answerFormal(llm, 'czy to jest tak?', null)).refused).toBe(true);
    expect(llm.prompts).toHaveLength(0);
  });
});
