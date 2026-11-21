import MiniSearch from 'minisearch';
import indexData from './index.json';

/*
 * BM25 retrieval (minisearch) over the static index built from knowledge/sources by
 * knowledge/scripts/build_index.py (docs/03 § 2.A „Indeks RAG”). Loaded once into function memory.
 */

export type KbSourceCode = 'USTAWA' | 'ROZP_2016' | 'ROZP_2015' | 'PORADNIK_OO' | 'PORADNIK_PO' | 'MODEL';

export interface Chunk {
  id: string;
  source: KbSourceCode;
  path: 'BOTH' | 'PERIODIC' | 'FIRST';
  unit: string | null;
  page: number | null;
  heading: string;
  text: string;
}

export interface Hit {
  chunk: Chunk;
  score: number;
  /** Share of the query's content terms present in the chunk (0–1). */
  coverage: number;
}

export const SOURCE_TITLES = indexData.sources as Record<KbSourceCode, string>;
export const CHUNKS = indexData.chunks as Chunk[];

const DIACRITICS: Record<string, string> = { ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z' };
const fold = (t: string) => t.toLowerCase().normalize('NFC').replace(/[ąćęłńóśźż]/g, (c) => DIACRITICS[c]);

const STOPWORDS = new Set(
  (
    'a aby albo ale ani bo by być był była było czy dla do gdy gdzie i ich ile im ja jak jaki jaka jakie jest jeśli jeżeli już ' +
    'ktoś która które który kto lub ma mam może można mu na nad nam nie niż o od oraz po pod przez przy się są ta tak także ten ' +
    'to tu tylko w we więc z za ze że co czym jego jej go mi mnie mój moja moje pan pani proszę których której temu ' +
    'jaką jakim tym tej tego te tych będzie mieć miał kiedy trzeba zrobić robić musi muszę mogę należy powinien bardzo dużo ' +
    'mało jeszcze teraz wtedy potem czyli każdy każda wszystkie inne inny taki taka takie coś nic jednak np itp ' +
    'dostać dostaje dostał dostała dostanie otrzymać otrzymuje otrzyma wynosi wynosić mają został została mogą powinno ' +
    'powinna dotyczy chodzi wiedzieć wiem znaczy oznacza ile ilu potem był była'
  )
    .split(/\s+/)
    .map(fold),
);

const SUFFIXES = ['owie', 'ami', 'ach', 'ego', 'emu', 'ych', 'ymi', 'imi', 'owi', 'ow', 'om', 'em', 'ie', 'ej', 'ym', 'im', 'a', 'e', 'i', 'o', 'u', 'y'];

/** Light Polish stemmer: strips the most common inflection suffix (min. 4 chars left) and cuts to 6 chars. */
export function stem(token: string): string {
  if (/\d/.test(token)) return token;
  let t = token;
  for (const s of SUFFIXES) {
    if (t.endsWith(s) && t.length - s.length >= 4) {
      t = t.slice(0, -s.length);
      break;
    }
  }
  return t.slice(0, 6);
}

export function terms(text: string): string[] {
  return fold(text)
    .replace(/§/g, ' paragraf ')
    // „arkusz B / arkusza C” → one token, so that „b)” / „c)” list markers do not match
    .replace(/\barkusz\w* ([abc])\b/g, ' arkusz ark$1 ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map(stem);
}

/**
 * Colloquial → statutory vocabulary (query expansion only — never shown as an answer).
 * The KPRM guides and acts use the terms on the right.
 */
const SYNONYMS: [RegExp, string][] = [
  [/\bl-?4\b|zwolnieni\w* lekarsk|chorob/i, 'usprawiedliwionej nieobecności w pracy trwającej dłużej niż miesiąc'],
  [/\burlop\w* (macierzy|rodzic|wychow)/i, 'usprawiedliwionej nieobecności w pracy'],
  [/odwoła|sprzeciw/i, 'sprzeciw dyrektora generalnego urzędu'],
  [/skład\w* sprawozd|złoż\w* sprawozd/i, 'termin na złożenie sprawozdania'],
  [/\biprz\b/i, 'indywidualnego programu rozwoju zawodowego'],
  [/jedynk|1 pkt|1 punkt|jeden punkt/i, 'ocena cząstkowa znacznie poniżej oczekiwań'],
  [/trójk|3 pkt|3 punkt/i, 'ocena cząstkowa 3 punktów'],
  [/nowy pracownik|nowo zatrudnion|pierwsz\w* ocen/i, 'pierwsza ocena służba przygotowawcza'],
  [/kierownik|naczelnik|kieruj/i, 'bezpośrednim kierowaniu pracownikami'],
];
export const expandQuery = (q: string) => [q, ...SYNONYMS.filter(([re]) => re.test(q)).map(([, add]) => add)].join(' ');

const mini = new MiniSearch<Chunk>({
  fields: ['text', 'heading', 'unit', 'sourceTitle'],
  storeFields: [],
  tokenize: (text) => text.split(/\s+/),
  processTerm: (t) => (t ? t : null),
  extractField: (doc, field) => {
    if (field === 'id') return doc.id;
    const raw = field === 'sourceTitle' ? SOURCE_TITLES[doc.source] : (doc as unknown as Record<string, unknown>)[field];
    return raw ? terms(String(raw)).join(' ') : '';
  },
  searchOptions: { boost: { heading: 1.5, unit: 1.2, sourceTitle: 0.6 }, combineWith: 'OR' },
});
mini.addAll(CHUNKS);
const byId = new Map(CHUNKS.map((c) => [c.id, c]));
const termSets = new Map(CHUNKS.map((c) => [c.id, new Set(terms(`${c.heading} ${c.text} ${SOURCE_TITLES[c.source]}`))]));

type SearchOpts = { path?: 'A' | 'B' | null; k?: number; only?: (c: Chunk) => boolean };

export function search(query: string, opts: SearchOpts = {}): Hit[] {
  const q = [...new Set(terms(query))];
  if (!q.length) return [];
  const allowed = opts.path === 'A' ? ['BOTH', 'FIRST'] : opts.path === 'B' ? ['BOTH', 'PERIODIC'] : null;
  return mini
    .search(q.join(' '), {
      filter: (r) => {
        const c = byId.get(String(r.id))!;
        return (!allowed || allowed.includes(c.path)) && (!opts.only || opts.only(c));
      },
    })
    .slice(0, opts.k ?? 8)
    .map((r) => {
      const set = termSets.get(String(r.id))!;
      return { chunk: byId.get(String(r.id))!, score: r.score, coverage: q.filter((t) => set.has(t)).length / q.length };
    });
}

/**
 * Reciprocal rank fusion of several query variants (original question + LLM keyword rewrite) —
 * improves recall for colloquial questions („L4”, „zwolnienie”) without embeddings.
 */
export function searchFused(queries: string[], opts: SearchOpts = {}): Hit[] {
  const fused = new Map<string, { hit: Hit; rrf: number }>();
  for (const q of queries.filter(Boolean)) {
    search(q, { ...opts, k: 20 }).forEach((hit, rank) => {
      const prev = fused.get(hit.chunk.id);
      const rrf = 1 / (60 + rank);
      if (prev) {
        prev.rrf += rrf;
        if (hit.coverage > prev.hit.coverage) prev.hit = { ...prev.hit, coverage: hit.coverage };
      } else fused.set(hit.chunk.id, { hit, rrf });
    });
  }
  return [...fused.values()].sort((a, b) => b.rrf - a.rrf).slice(0, opts.k ?? 8).map((x) => x.hit);
}

const LEGAL: KbSourceCode[] = ['USTAWA', 'ROZP_2016', 'ROZP_2015'];
/** Editorial units of the acts (articles, paragraphs, annex 1) — not the form templates. */
const isStatutory = (c: Chunk) => LEGAL.includes(c.source) && /^(art\.|§|załącznik nr 1)/.test(c.unit ?? '');
const byUnit = new Map<string, Chunk[]>();
for (const c of CHUNKS) {
  if (!c.unit || !LEGAL.includes(c.source)) continue;
  const key = `${c.source}|${c.unit}`;
  byUnit.set(key, [...(byUnit.get(key) ?? []), c]);
}

/** Legal units a chunk refers to („art. 81 ust. 7 ustawy”, „§ 10 ust. 1 rozporządzenia”). */
export function crossReferences(chunk: Chunk): Chunk[] {
  const out: Chunk[] = [];
  const rozp: KbSourceCode = chunk.path === 'FIRST' ? 'ROZP_2015' : 'ROZP_2016';
  for (const m of chunk.text.matchAll(/\bart\. (\d+[a-z]?)(?: ust\. (\d+[a-z]?))?/g)) {
    out.push(...(byUnit.get(`USTAWA|art. ${m[1]}${m[2] ? ` ust. ${m[2]}` : ''}`) ?? []).slice(0, 1));
  }
  if (chunk.source !== 'USTAWA') {
    for (const m of chunk.text.matchAll(/§ (\d+)(?: ust\. (\d+))?/g)) {
      const src = chunk.source.startsWith('ROZP') ? chunk.source : rozp;
      out.push(...(byUnit.get(`${src}|§ ${m[1]}${m[2] ? ` ust. ${m[2]}` : ''}`) ?? []).slice(0, 1));
    }
  }
  return out.filter((c) => c.id !== chunk.id);
}

/** Same-article ustępy that refer to this one („o którym mowa w ust. 7”) — exceptions and qualifications. */
export function siblingReferences(chunk: Chunk): Chunk[] {
  const m = chunk.unit?.match(/^(art\.|§) (\d+[a-z]*) ust\. (\d+[a-z]*)$/);
  if (!m || !isStatutory(chunk)) return [];
  const re = new RegExp(`\\bust\\. ${m[3]}(?![0-9a-z])`);
  return CHUNKS.filter(
    (c) => c.source === chunk.source && c.id !== chunk.id && c.unit?.startsWith(`${m[1]} ${m[2]} ust.`) && re.test(c.text),
  ).slice(0, 2);
}

/**
 * Retrieval used by the Formal Assistant: fused BM25 over the question (+ optional LLM keyword rewrite),
 * a separate pool from the legal acts (short units would otherwise lose to long guide pages),
 * the legal units cited by the retrieved guide pages and same-article ustępy referring to retrieved ones.
 * Max 14 fragments.
 */
export function retrieve(question: string, opts: { path?: 'A' | 'B' | null; rewrite?: string | null } = {}): Hit[] {
  const queries = [expandQuery(question), opts.rewrite ?? ''];
  const general = searchFused(queries, { path: opts.path, k: 6 });
  const legal = searchFused(queries, { path: opts.path, k: 6, only: isStatutory });
  const out = new Map<string, Hit>();
  for (const h of [...general, ...legal]) out.set(h.chunk.id, h);
  const allowed = opts.path === 'A' ? ['BOTH', 'FIRST'] : opts.path === 'B' ? ['BOTH', 'PERIODIC'] : null;
  const refs = [
    ...legal.flatMap((h) => siblingReferences(h.chunk).map((c) => [c, h] as const)),
    ...general.slice(0, 4).flatMap((h) => crossReferences(h.chunk).map((c) => [c, h] as const)),
  ];
  {
    for (const [ref, h] of refs) {
      if (out.size >= 14) break;
      if (!out.has(ref.id) && (!allowed || allowed.includes(ref.path))) out.set(ref.id, { chunk: ref, score: 0, coverage: h.coverage });
    }
  }
  return [...out.values()];
}
