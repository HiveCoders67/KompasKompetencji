import { describe, expect, it } from 'vitest';
import type { LlmProvider } from '../llm';
import { answerFormal, quoteInFragment, REFUSAL } from './formal';
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

  it('mislabelled unit with a verified quote → accepted, unit and page taken from the index', async () => {
    const llm = fake((p) => ({
      answer: '7 dni, do dyrektora generalnego urzędu.',
      citations: [{ fragment: fragmentOf(p, 'art. 83 ust. 1'), unit: 'Sprzeciw od oceny', page: 3, quote: 'w terminie 7 dni od dnia zapoznania się z oceną' }],
    }));
    const r = await answerFormal(llm, Q, ctx);
    expect(r.refused).toBe(false);
    expect(r.citations[0]).toMatchObject({ source: 'USTAWA', unit: 'art. 83 ust. 1', page: 25 });
  });

  it('rejects an invented quote and a fragment that was not retrieved', async () => {
    const quote = fake((p) => ({ answer: 'x', citations: [{ fragment: fragmentOf(p, 'art. 83 ust. 1'), unit: 'art. 83 ust. 1', quote: 'w terminie 14 dni' }] }));
    expect((await answerFormal(quote, Q, ctx)).refused).toBe(true);
    const missing = fake(() => ({ answer: 'x', citations: [{ fragment: 'F99', unit: 'art. 83 ust. 1' }] }));
    expect((await answerFormal(missing, Q, ctx)).refused).toBe(true);
  });

  it('quote with elisions: every part must occur verbatim and in order', () => {
    const text = 'przyznaniu oceny negatywnej – w przypadku ustalenia poziomu poniżej oczekiwań, a także w przypadku uzyskania jednej oceny cząstkowej';
    expect(quoteInFragment('przyznaniu oceny negatywnej – [...] w przypadku uzyskania jednej oceny', text)).toBe(true);
    expect(quoteInFragment('„przyznaniu oceny negatywnej”…', text)).toBe(true);
    expect(quoteInFragment('w przypadku uzyskania […] przyznaniu oceny negatywnej', text)).toBe(false); // wrong order
    expect(quoteInFragment('przyznaniu oceny pozytywnej [...] w przypadku uzyskania', text)).toBe(false); // invented words
    expect(quoteInFragment('[...]', text)).toBe(false);
  });

  it('quote matching ignores list markers and punctuation, tolerates one typo in a long word, nothing more', () => {
    const text = 'według skali ocen: a) znacznie poniżej oczekiwań – 1 punkt, b) poniżej oczekiwań – 3 punkty, c) na poziomie oczekiwań – 5 punktów';
    expect(quoteInFragment('znaczenie poniżej oczekiwań – 1 punkt, poniżej oczekiwań – 3 punkty', text)).toBe(true);
    expect(quoteInFragment('znacznie poniżej oczekiwań – 2 punkty', text)).toBe(false); // changed number
    expect(quoteInFragment('znacznie powyżej oczekiwań – 1 punkt', text)).toBe(false); // changed word
    expect(quoteInFragment('poniżej oczekiwań – 5 punktów', text)).toBe(false); // words not adjacent in the source
  });

  it('quote matching survives words split by PDF extraction, but letters must still match exactly', () => {
    const pdf = 'W razie u sprawiedliwionej nieobecności ocenianego w pracy, trwając ej dłużej niż miesiąc, termin ule ga przedłużeniu';
    expect(quoteInFragment('W razie usprawiedliwionej nieobecności ocenianego w pracy, trwającej dłużej niż miesiąc', pdf)).toBe(true);
    expect(quoteInFragment('W razie usprawiedliwionej nieobecności ocenianego w pracy, trwającej dłużej niż rok', pdf)).toBe(false);
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
