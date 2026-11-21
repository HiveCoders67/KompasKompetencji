import { strFromU8, unzipSync } from 'fflate';
import { COMPETENCIES } from './competencies';
import type { CompetencyCode, FormType, Osp, Subordinates } from './types';

/*
 * OSP (job description) analysis — docs/02 § 1.2, docs/03 § 2.C.
 * The form rule and the DOCX parser are deterministic code; AI only suggests additional criteria.
 */

export const FORM_B_WARNING =
  'Pole OSP obejmuje także koordynowanie. Arkusz B dotyczy wyłącznie stanowisk, na których praca polega na bezpośrednim kierowaniu pracownikami (§ 3 ust. 3 rozp. z 2016 r.). Potwierdź.';

/** „brak podległych” → C; any „kieruje lub koordynuje” / „podlegają osoby kierujące” → B (needs confirmation). */
export function recommendForm(subordinates: Subordinates): FormType {
  return subordinates === 'NONE' ? 'FORM_C' : 'FORM_B';
}

export const needsManagementConfirmation = (osp: Pick<Osp, 'subordinates'>): boolean => osp.subordinates !== 'NONE';

/** Form actually used: B only when the supervisor confirmed direct management; coordination alone → C. */
export function resolveForm(osp: Pick<Osp, 'subordinates' | 'managementConfirmed'>): FormType | null {
  if (osp.subordinates === 'NONE') return 'FORM_C';
  if (osp.managementConfirmed === true) return 'FORM_B';
  if (osp.managementConfirmed === false) return 'FORM_C';
  return null;
}

// ------------------------------------------------------------- DOCX parser

export interface ParsedOsp extends Omit<Osp, 'managementConfirmed' | 'recommendedForm'> {
  officeName: string;
  indirectSupervisorPosition: string;
  otherTasks: string[];
  warnings: string[];
}

interface Line {
  text: string;
  checked: boolean | null;
}

const decode = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

/** Paragraph-level text of word/document.xml with checkbox state (w14:checkbox or ☒/☐ symbols). */
export function docxLines(documentXml: string): Line[] {
  const lines: Line[] = [];
  for (const p of documentXml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? []) {
    let text = '';
    let checked: boolean | null = null;
    const re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w14:checked w14:val="(\d)"|<w:sym [^>]*w:char="([0-9A-Fa-f]+)"|<w:tab\/>|<w:br\/>/g;
    for (let m = re.exec(p); m; m = re.exec(p)) {
      if (m[1] !== undefined) text += decode(m[1]);
      else if (m[2] !== undefined) checked = m[2] === '1';
      else if (m[3] !== undefined) {
        const ch = m[3].toUpperCase();
        if (checked === null && ['F0FE', 'F078'].includes(ch)) checked = true;
        if (checked === null && ['F0A8', 'F06F'].includes(ch)) checked = false;
      } else text += ' ';
    }
    text = text.replace(/[☒☐]/g, (c) => {
      if (checked === null) checked = c === '☒';
      return '';
    });
    text = text.replace(/\s+/g, ' ').trim();
    if (text) lines.push({ text, checked });
  }
  return lines;
}

const SUBORDINATE_OPTIONS: [RegExp, Subordinates][] = [
  [/^brak podległych/i, 'NONE'],
  [/do 4 pracowników/i, 'UP_TO_4'],
  [/od 5 do 9/i, 'FROM_5_TO_9'],
  [/powyżej 9/i, 'ABOVE_9'],
  [/podlegają osoby kierujące/i, 'MANAGERS_SUBORDINATE'],
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-ząćęłńóśźż ]/g, ' ').replace(/\s+/g, ' ').trim();

/** Maps the free-text „Kompetencje miękkie” list onto competency codes. */
export function matchCompetencies(items: string[]): CompetencyCode[] {
  const out: CompetencyCode[] = [];
  for (const item of items) {
    const n = norm(item);
    if (!n) continue;
    const hit = COMPETENCIES.find((c) => {
      const name = norm(c.name);
      return n.startsWith(name) || name.startsWith(n) || n.includes(name.split(' ').slice(0, 2).join(' '));
    });
    if (hit && !out.includes(hit.code)) out.push(hit.code);
  }
  return out;
}

export function parseOspDocumentXml(documentXml: string): ParsedOsp {
  const lines = docxLines(documentXml);
  const texts = lines.map((l) => l.text);
  const warnings: string[] = [];
  const idx = (re: RegExp, from = 0) => texts.findIndex((t, i) => i >= from && re.test(t));
  const after = (re: RegExp, skip: RegExp[] = []) => {
    const i = idx(re);
    if (i < 0) return '';
    for (let j = i + 1; j < texts.length; j++) if (!skip.some((s) => s.test(texts[j]))) return texts[j];
    return '';
  };
  const between = (start: RegExp, end: RegExp) => {
    const i = idx(start);
    if (i < 0) return [] as Line[];
    const j = idx(end, i + 1);
    return lines.slice(i + 1, j < 0 ? undefined : j);
  };

  const unitLines = between(/^NAZWA KOMÓRKI ORGANIZACYJNEJ/i, /^NAZWA STANOWISKA PRACY/i).map((l) => l.text);
  const subordinateLines = between(/^LICZBA PODLEGŁYCH PRACOWNIKÓW/i, /^GŁÓWNE ZADANIA/i);
  const checkedSub = subordinateLines.filter((l) => l.checked);
  let subordinates: Subordinates = 'NONE';
  if (checkedSub.length === 0) warnings.push('Nie odczytano pola „Liczba podległych pracowników” — przyjęto „brak podległych pracowników”.');
  else {
    const match = SUBORDINATE_OPTIONS.find(([re]) => re.test(checkedSub[0].text));
    if (match) subordinates = match[1];
    if (checkedSub.length > 1) warnings.push('Zaznaczono więcej niż jedną opcję liczby podległych pracowników — przyjęto pierwszą.');
  }

  const taskLines = between(/^GŁÓWNE ZADANIA REALIZOWANE/i, /^UPOWAŻNIENIA I PEŁNOMOCNICTWA/i).map((l) => l.text);
  const otherIdx = taskLines.findIndex((t) => /^POZOSTAŁE ZADANIA/i.test(t));
  const isTask = (t: string) => /^Zadanie \d+/i.test(t);
  const stripTask = (t: string) => t.replace(/^Zadanie \d+:\s*/i, '');
  const mainTasks = (otherIdx < 0 ? taskLines : taskLines.slice(0, otherIdx)).filter(isTask).map(stripTask);
  const otherTasks = (otherIdx < 0 ? [] : taskLines.slice(otherIdx + 1)).filter(isTask).map(stripTask);

  const softStart = idx(/^Kompetencje miękkie/i);
  const soft: string[] = [];
  if (softStart >= 0) {
    for (let j = softStart + 1; j < texts.length && !/^DOŚWIADCZENIE ZAWODOWE/i.test(texts[j]); j++) {
      soft.push(...texts[j].split(/[,;]/).map((s) => s.replace(/^[-–•\s]+/, '').replace(/\.$/, '').trim()));
    }
  } else warnings.push('Nie znaleziono sekcji „Kompetencje miękkie”.');

  const checkedIn = (start: RegExp, end: RegExp) => between(start, end).filter((l) => l.checked).map((l) => l.text);

  return {
    officeName: after(/^NAZWA URZĘDU/i),
    department: unitLines[0] ?? '',
    unit: unitLines.slice(1).join(' '),
    positionName: after(/^NAZWA STANOWISKA PRACY/i),
    symbol: after(/^SYMBOL STANOWISKA PRACY/i),
    indirectSupervisorPosition: after(/^STANOWISKO PRACY POŚREDNIO NADZORUJĄCE/i),
    directSupervisorPosition: after(/^STANOWISKO PRACY BEZPOŚREDNIO NADZORUJĄCE/i),
    subordinates,
    purpose: between(/^CEL ISTNIENIA STANOWISKA PRACY/i, /^LICZBA PODLEGŁYCH/i).map((l) => l.text),
    mainTasks,
    otherTasks,
    softCompetencies: matchCompetencies(soft),
    authorizations: checkedIn(/^UPOWAŻNIENIA I PEŁNOMOCNICTWA/i, /^ZŁOŻONOŚĆ I KREATYWNOŚĆ/i),
    difficultyFactors: checkedIn(/^CZYNNIKI SZCZEGÓLNIE UTRUDNIAJĄCE/i, /^PRZYKŁADY/i),
    warnings,
  };
}

/** Parses a DOCX file (MC OSP template). PDF / scans are out of scope (docs/03 § 2.C). */
export function parseOspDocx(bytes: Uint8Array): ParsedOsp {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, { filter: (f) => f.name === 'word/document.xml' });
  } catch {
    throw new Error('Plik nie jest prawidłowym dokumentem DOCX.');
  }
  const xml = files['word/document.xml'];
  if (!xml) throw new Error('W pliku DOCX brak treści dokumentu (word/document.xml).');
  return parseOspDocumentXml(strFromU8(xml));
}

/** Converts the parser output into the `employees.osp` structure. */
export function toOsp(p: ParsedOsp): Osp {
  return {
    symbol: p.symbol,
    positionName: p.positionName,
    department: p.department,
    unit: p.unit,
    directSupervisorPosition: p.directSupervisorPosition,
    subordinates: p.subordinates,
    managementConfirmed: null,
    recommendedForm: recommendForm(p.subordinates),
    mainTasks: [...p.mainTasks, ...p.otherTasks],
    softCompetencies: p.softCompetencies,
    purpose: p.purpose,
    authorizations: p.authorizations,
    difficultyFactors: p.difficultyFactors,
  };
}
