import type { Citation, ScreenContext } from '@kompas/domain';
import { FORM_SHORT, STATUS_LABELS } from '@kompas/domain';
import { parseJsonObject, type LlmProvider } from '../llm';
import { retrieve, SOURCE_TITLES, type Chunk, type Hit } from './search';

/*
 * Formal Assistant — strict grounding (docs/03 § 2.A):
 *  1. BM25 retrieval over knowledge/sources (screen context is NOT part of the query),
 *  2. below the relevance threshold → refusal without calling the model,
 *  3. the model answers ONLY from numbered fragments and returns JSON with structured citations,
 *  4. every citation is validated in code against the retrieved fragments' {source, unit, page};
 *     a mismatch (or a quote not found in the fragment) → the answer is replaced by the refusal.
 */

export const REFUSAL =
  'W udostępnionej bazie wiedzy nie znalazłem informacji na ten temat. Proszę skonsultować tę kwestię z komórką kadr (HR).';

/** Minimum share of the question's content terms found in the best fragment. */
export const MIN_COVERAGE = 0.34;

export interface FormalAnswer {
  content: string;
  refused: boolean;
  citations: Citation[];
  /** Diagnostics for the test set / logs (not stored). */
  debug: { fragments: string[]; reason?: string };
}

interface ModelCitation {
  fragment: string;
  unit?: string | null;
  page?: number | null;
  quote?: string;
}
interface ModelAnswer {
  answer: string;
  insufficient?: boolean;
  citations?: ModelCitation[];
}

const SYSTEM = `Jesteś Asystentem Formalnym Oceny w służbie cywilnej. Odpowiadasz przełożonemu na pytania o przepisy i procedurę pierwszej oceny oraz oceny okresowej.

ZASADY (bezwzględne):
1. Odpowiadasz WYŁĄCZNIE na podstawie fragmentów oznaczonych [F1], [F2]… podanych w wiadomości. Nie korzystasz z własnej wiedzy, nie zgadujesz i nie dopowiadasz.
2. Jeżeli fragmenty nie zawierają odpowiedzi na pytanie, ustaw "insufficient": true i nie odpowiadaj merytorycznie.
3. Każde twierdzenie merytoryczne musi być poparte cytatem. Cytat wskazuje identyfikator fragmentu, jego jednostkę redakcyjną i stronę DOKŁADNIE tak, jak podano w nagłówku fragmentu (możesz doprecyzować punkt, np. "§ 11 ust. 1 pkt 4"), oraz krótki dosłowny wyjątek (do 200 znaków) skopiowany z treści fragmentu.
4. Nie wystawiasz ocen pracownikom i nie podejmujesz decyzji kadrowych — wyjaśniasz przepisy. Przy pytaniach o konkretny przypadek zastosuj przepis do podanych faktów i zacznij od jednoznacznej odpowiedzi (np. „Nie — ocena jest negatywna, ponieważ…”).
5. Kontekst ekranu służy tylko do dopasowania odpowiedzi (np. ścieżka pierwszej oceny vs oceny okresowej), nie jest źródłem.
6. Pisz po polsku, rzeczowo, maksymalnie 8 zdań. Bez nagłówków markdown.

Zwróć WYŁĄCZNIE obiekt JSON:
{"answer": "treść odpowiedzi", "insufficient": false, "citations": [{"fragment": "F2", "unit": "art. 81 ust. 7", "page": 24, "quote": "dosłowny wyjątek"}]}`;

export function describeContext(ctx: ScreenContext | null): string {
  if (!ctx || (!ctx.path && !ctx.formType && !ctx.step && !ctx.status)) return 'brak (pytanie ogólne)';
  return [
    ctx.path === 'A' ? 'ścieżka A — pierwsza ocena' : ctx.path === 'B' ? 'ścieżka B — ocena okresowa' : null,
    ctx.formType ? `arkusz: ${FORM_SHORT[ctx.formType]}` : null,
    ctx.step ? `krok: ${ctx.step}` : null,
    ctx.status ? `status oceny: ${STATUS_LABELS[ctx.status]}` : null,
  ]
    .filter(Boolean)
    .join('; ');
}

const header = (c: Chunk) =>
  `${SOURCE_TITLES[c.source]} | jednostka: ${c.unit ?? '—'} | strona: ${c.page ?? '—'}${c.heading ? ` | ${c.heading}` : ''}`;

export function buildPrompt(question: string, hits: Hit[], ctx: ScreenContext | null): string {
  const fragments = hits.map((h, i) => `[F${i + 1}] ${header(h.chunk)}\n${h.chunk.text}`).join('\n\n');
  return `KONTEKST EKRANU: ${describeContext(ctx)}\n\nFRAGMENTY BAZY WIEDZY:\n${fragments}\n\nPYTANIE: ${question}`;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[„”"'«»]/g, '')
    .replace(/[\s ]+/g, ' ')
    .replace(/[–—-]/g, '-')
    .trim();

/** A cited unit matches the fragment if equal or more specific („§ 11 ust. 1 pkt 4” ⊂ „§ 11 ust. 1”). */
function unitMatches(cited: string | null | undefined, actual: string | null): boolean {
  if (!actual) return cited === null || cited === undefined || cited === '' || cited === '—';
  if (!cited) return false;
  const a = norm(actual);
  const c = norm(cited);
  return c === a || c.startsWith(`${a} `) || c.startsWith(`${a},`);
}

export function validateCitations(raw: ModelCitation[] | undefined, hits: Hit[]): { ok: boolean; citations: Citation[]; reason?: string } {
  if (!raw?.length) return { ok: false, citations: [], reason: 'brak cytatów' };
  const citations: Citation[] = [];
  for (const c of raw) {
    const idx = Number(String(c.fragment ?? '').replace(/\D/g, '')) - 1;
    const hit = hits[idx];
    if (!hit) return { ok: false, citations: [], reason: `nieznany fragment ${c.fragment}` };
    const ch = hit.chunk;
    if (!unitMatches(c.unit, ch.unit)) return { ok: false, citations: [], reason: `jednostka ${c.unit} ≠ ${ch.unit}` };
    if ((c.page ?? null) !== null && ch.page !== null && Number(c.page) !== ch.page) {
      return { ok: false, citations: [], reason: `strona ${c.page} ≠ ${ch.page}` };
    }
    if (c.quote && !norm(ch.text).includes(norm(c.quote).replace(/(\.\.\.|…)$/, '').trim())) {
      return { ok: false, citations: [], reason: `cytat spoza fragmentu ${c.fragment}` };
    }
    if (citations.some((x) => x.source === ch.source && x.unit === (c.unit || ch.unit) && x.page === ch.page)) continue;
    citations.push({
      source: ch.source,
      sourceTitle: SOURCE_TITLES[ch.source],
      unit: c.unit || ch.unit,
      page: ch.page,
      excerpt: c.quote?.trim() || ch.text.slice(0, 200),
    });
  }
  return { ok: true, citations };
}

export async function answerFormal(llm: LlmProvider, question: string, ctx: ScreenContext | null): Promise<FormalAnswer> {
  const hits = retrieve(question, { path: ctx?.path ?? null });
  const fragments = hits.map((h) => `${h.chunk.source} ${h.chunk.unit ?? ''} s.${h.chunk.page ?? '—'}`);
  const refuse = (reason: string): FormalAnswer => ({ content: REFUSAL, refused: true, citations: [], debug: { fragments, reason } });
  if (!hits.length || Math.max(...hits.map((h) => h.coverage)) < MIN_COVERAGE) return refuse('poniżej progu trafności');

  const raw = await llm.generate({ system: SYSTEM, user: buildPrompt(question, hits, ctx), temperature: 0.1 });
  const parsed = parseJsonObject<ModelAnswer>(raw);
  if (!parsed || typeof parsed.answer !== 'string') return refuse('niepoprawny JSON modelu');
  if (parsed.insufficient) return refuse('model: brak informacji we fragmentach');
  const v = validateCitations(parsed.citations, hits);
  if (!v.ok) return refuse(`walidacja cytatów: ${v.reason}`);
  return { content: parsed.answer.trim(), refused: false, citations: v.citations, debug: { fragments } };
}
