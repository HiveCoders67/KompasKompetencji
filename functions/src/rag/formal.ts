import type { Citation, ScreenContext } from '@kompas/domain';
import { FORM_SHORT, STATUS_LABELS } from '@kompas/domain';
import { parseJsonObject, type LlmProvider } from '../llm';
import { retrieve, SOURCE_TITLES, type Chunk, type Hit } from './search';

/*
 * Formal Assistant — strict grounding (docs/03 § 2.A):
 *  1. BM25 retrieval over knowledge/sources (screen context is NOT part of the query),
 *  2. below the relevance threshold → refusal without calling the model,
 *  3. the model answers ONLY from numbered fragments and returns JSON with structured citations,
 *  4. every citation is validated in code against the retrieved fragments: the fragment must have been retrieved
 *     and the quote must occur in it verbatim; without a quote, unit and page must match the metadata.
 *     Any failure → the answer is replaced by the refusal. Displayed unit/page always come from the index.
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
2. Jeżeli fragmenty nie zawierają odpowiedzi na pytanie, ustaw "insufficient": true i nie odpowiadaj merytorycznie. Pytania potoczne odnoś do pojęć z przepisów (np. „ocena roczna” → ocena okresowa, „L4” → usprawiedliwiona nieobecność) i zaznacz to w odpowiedzi jednym zdaniem — nie odmawiaj tylko z powodu innego słownictwa.
3. Każde twierdzenie merytoryczne musi być poparte cytatem. Każdy fragment ma nagłówek: [Fn] źródło: … | jednostka: … | strona: … | tytuł sekcji: …. Dla każdego cytatu podaj:
   - "fragment": identyfikator fragmentu, np. "F2";
   - "unit": wartość pola „jednostka” z nagłówka TEGO fragmentu, przepisana znak w znak (np. "rozdz. 5.3", "art. 36 ust. 8", "§ 10 ust. 1"). Nie wpisuj tytułu sekcji ani przepisu przywołanego w treści fragmentu — jeśli fragment poradnika z jednostką "rozdz. 4.1" omawia § 4 ust. 1, to "unit" = "rozdz. 4.1". Tylko przy artykule lub paragrafie możesz doprecyzować punkt, np. "§ 11 ust. 1 pkt 4";
   - "page": wartość pola „strona” z nagłówka tego fragmentu;
   - "quote": od 5 do 25 kolejnych słów przepisanych z treści tego fragmentu DOSŁOWNIE — bez zmiany odmiany i szyku, bez skrótów, bez wielokropków, bez łączenia kilku zdań, z zachowaniem ewentualnych literówek.
   Jeśli we fragmentach jest zarówno przepis (ustawa, rozporządzenie), jak i poradnik, cytuj przede wszystkim przepis.
4. Nie wystawiasz ocen pracownikom i nie podejmujesz decyzji kadrowych — wyjaśniasz przepisy. Przy pytaniach o konkretny przypadek zastosuj przepis do podanych faktów (liczb, okresów, dat) i podaj konkretny skutek dla tego przypadku, a nie tylko ogólną regułę (np. „Tak — termin przedłuża się o 60 dni, bo nieobecność trwała dłużej niż miesiąc”). Zacznij od jednoznacznej odpowiedzi; wynik oceny podaj w mianowniku, tak jak w przepisach — „Ocena pozytywna — …” albo „Ocena negatywna — …”. Jeśli wynik zależy od obliczeń (średnia ocen, liczba dni, przesunięcie terminu), pokaż je z liczbami z pytania.
5. Kontekst ekranu służy tylko do dopasowania odpowiedzi (np. ścieżka pierwszej oceny vs oceny okresowej), nie jest źródłem.
6. Pisz po polsku, rzeczowo, maksymalnie 8 zdań. Bez nagłówków markdown.

Zwróć WYŁĄCZNIE obiekt JSON:
{"answer": "treść odpowiedzi", "insufficient": false, "citations": [{"fragment": "F2", "unit": "art. 81 ust. 7", "page": 24, "quote": "dosłowny wyjątek"}]}`;

/** Structured output schema — the Gemini API then always returns a parsable object of this shape. */
const ANSWER_SCHEMA = {
  type: 'OBJECT',
  properties: {
    answer: { type: 'STRING' },
    insufficient: { type: 'BOOLEAN' },
    citations: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          fragment: { type: 'STRING' },
          unit: { type: 'STRING', nullable: true },
          page: { type: 'INTEGER', nullable: true },
          quote: { type: 'STRING' },
        },
        required: ['fragment', 'quote'],
      },
    },
  },
  required: ['answer', 'insufficient', 'citations'],
};

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
  `źródło: ${SOURCE_TITLES[c.source]} | jednostka: ${c.unit ?? '—'} | strona: ${c.page ?? '—'}${c.heading ? ` | tytuł sekcji: ${c.heading}` : ''}`;

export function buildPrompt(question: string, hits: Hit[], ctx: ScreenContext | null): string {
  const fragments = hits.map((h, i) => `[F${i + 1}] ${header(h.chunk)}\n${h.chunk.text}`).join('\n\n');
  return `KONTEKST EKRANU: ${describeContext(ctx)}\n\nFRAGMENTY BAZY WIEDZY:\n${fragments}\n\nPYTANIE: ${question}`;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[„”“"'‘’‚«»]/g, '')
    .replace(/[\s ]+/g, ' ')
    .replace(/[–—−-]/g, '-')
    .trim();

/** Elision marks the model may use inside a verbatim quote: [...], […], (...), ..., … */
const ELISION = /\[\s*(?:\.\.\.|…)\s*\]|\(\s*(?:\.\.\.|…)\s*\)|\.\.\.|…/;

/**
 * A quote is grounded if every part between elision marks occurs verbatim in the fragment, in order.
 * Elisions only skip text — they never allow words that are not in the source.
 */
export function quoteInFragment(quote: string, text: string): boolean {
  const parts = quote
    .split(ELISION)
    .map(words)
    .filter((p) => p.length);
  if (!parts.length) return false;
  return wordRunsMatch(words(text), parts) || compactMatch(text, parts);
}

function wordRunsMatch(haystack: string[], parts: string[][]): boolean {
  let from = 0;
  for (const part of parts) {
    const at = findRun(haystack, part, from);
    if (at < 0) return false;
    from = at + part.length;
  }
  return true;
}

/**
 * Fallback for PDF extraction artefacts in the guides („u rzędu”, „trwając a”): compares letters only,
 * ignoring spaces. Exact letters (no typo tolerance), parts in order, and each part must be ≥ 20 letters.
 */
function compactMatch(text: string, parts: string[][]): boolean {
  const hay = words(text).join('');
  let from = 0;
  for (const part of parts) {
    const p = part.join('');
    if (p.length < 20) return false;
    const at = hay.indexOf(p, from);
    if (at < 0) return false;
    from = at + p.length;
  }
  return true;
}

/**
 * Words for quote matching: list markers („a)”, „1)”, „pkt 2)”) and punctuation are ignored —
 * models routinely drop them when copying an enumerated provision.
 */
function words(s: string): string[] {
  return norm(s)
    .replace(/(^|\s)(?:[a-z]|\d{1,2})\)(?=\s|$)/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** Words match if equal, or — for words of 6+ letters — differ by a single edit (copying typo, e.g. „znaczenie”/„znacznie”). */
function wordMatches(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 6 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/** Index of the first contiguous run in `hay` (from `from`) matching every word of `needle`, or -1. */
function findRun(hay: string[], needle: string[], from: number): number {
  for (let s = from; s + needle.length <= hay.length; s++) {
    if (needle.every((w, k) => wordMatches(hay[s + k], w))) return s;
  }
  return -1;
}

/** Alias kept for callers/tests using the previous name. */
export const quoteInText = (quote: string, text: string): boolean => quoteInFragment(quote, text);

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
    // validated against exactly what the model was shown as this fragment (header line + text)
    if (c.quote && !quoteInFragment(c.quote, `${header(ch)}\n${ch.text}`)) {
      return { ok: false, citations: [], reason: `cytat spoza fragmentu ${c.fragment}` };
    }
    const unitOk = unitMatches(c.unit, ch.unit);
    const citedPage = Number.isFinite(Number(c.page)) && c.page !== null && c.page !== undefined ? Number(c.page) : null;
    const pageOk = citedPage === null || ch.page === null || citedPage === ch.page;
    // A verified verbatim quote grounds the citation even if the model mislabelled the unit/page —
    // the displayed unit and page then come from the index metadata, never from the model.
    if (!c.quote && !unitOk) return { ok: false, citations: [], reason: `jednostka ${c.unit} ≠ ${ch.unit}` };
    if (!c.quote && !pageOk) return { ok: false, citations: [], reason: `strona ${c.page} ≠ ${ch.page}` };
    const unit = unitOk && c.unit ? c.unit : ch.unit;
    if (citations.some((x) => x.source === ch.source && x.unit === unit && x.page === ch.page)) continue;
    citations.push({
      source: ch.source,
      sourceTitle: SOURCE_TITLES[ch.source],
      unit,
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

  const raw = await llm.generate({ system: SYSTEM, user: buildPrompt(question, hits, ctx), temperature: 0.1, json: true, jsonSchema: ANSWER_SCHEMA });
  const parsed = parseJsonObject<ModelAnswer>(raw);
  if (!parsed || typeof parsed.answer !== 'string') return refuse('niepoprawny JSON modelu');
  if (parsed.insufficient) return refuse('model: brak informacji we fragmentach');
  const v = validateCitations(parsed.citations, hits);
  if (!v.ok) return refuse(`walidacja cytatów: ${v.reason}`);
  return { content: parsed.answer.trim(), refused: false, citations: v.citations, debug: { fragments } };
}
