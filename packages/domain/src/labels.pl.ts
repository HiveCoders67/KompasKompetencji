import type {
  CompetencyCode,
  ContractType,
  EmploymentType,
  EvaluationStatus,
  EvaluationType,
  ExamPassed,
  FinalResult,
  FormType,
  OverallLevel,
  ReminderType,
  Role,
  Score,
  Subordinates,
  YesNo,
} from './types';

/*
 * The only dictionary of Polish labels for enum codes (CLAUDE.md „Enumy”).
 * Data never stores Polish text as an enum value.
 */

export const ROLE_LABELS: Record<Role, string> = {
  SUPERVISOR: 'Przełożony',
  DEPARTMENT_HEAD: 'Kierujący komórką organizacyjną',
  HR_ADMIN: 'HR / Administrator',
};

export const TYPE_LABELS: Record<EvaluationType, string> = {
  FIRST_EVALUATION: 'Pierwsza ocena',
  PERIODIC_EVALUATION: 'Ocena okresowa',
};

export const FORM_LABELS: Record<FormType, string> = {
  FIRST: 'Arkusz pierwszej oceny',
  FORM_B: 'Arkusz B — bezpośrednie kierowanie pracownikami',
  FORM_C: 'Arkusz C — inne stanowisko pracy',
};

export const FORM_SHORT: Record<FormType, string> = {
  FIRST: 'Pierwsza ocena',
  FORM_B: 'Arkusz B',
  FORM_C: 'Arkusz C',
};

export const STATUS_LABELS: Record<EvaluationStatus, string> = {
  DRAFT: 'Wersja robocza',
  INITIAL_TALK_DONE: 'Po rozmowie wstępnej',
  REPORT_SUBMITTED: 'Sprawozdanie złożone',
  IN_PROGRESS: 'Ocena w toku',
  FINAL_TALK_DONE: 'Po rozmowie oceniającej',
  COMPLETED: 'Ocena sporządzona',
  ACKNOWLEDGED: 'Oceniany zapoznał się',
};

/** Path B calls the initial talk „rozmowa rozpoczynająca”. */
export function statusLabel(status: EvaluationStatus, type: EvaluationType): string {
  if (status === 'INITIAL_TALK_DONE' && type === 'PERIODIC_EVALUATION') return 'Po rozmowie rozpoczynającej';
  return STATUS_LABELS[status];
}

export const SCORE_LABELS: Record<Score, string> = {
  1: 'znacznie poniżej oczekiwań',
  3: 'poniżej oczekiwań',
  5: 'na poziomie oczekiwań',
  7: 'powyżej oczekiwań',
  9: 'znacznie powyżej oczekiwań',
};

export const LEVEL_LABELS: Record<OverallLevel, string> = {
  FAR_BELOW_EXPECTATIONS: 'znacznie poniżej oczekiwań',
  BELOW_EXPECTATIONS: 'poniżej oczekiwań',
  MEETS_EXPECTATIONS: 'na poziomie oczekiwań',
  ABOVE_EXPECTATIONS: 'powyżej oczekiwań',
  FAR_ABOVE_EXPECTATIONS: 'znacznie powyżej oczekiwań',
};

export const RESULT_LABELS: Record<FinalResult, string> = {
  POSITIVE: 'POZYTYWNA',
  NEGATIVE: 'NEGATYWNA',
};

export const EXAM_LABELS: Record<ExamPassed, string> = {
  YES: 'TAK',
  NO: 'NIE',
  NOT_APPLICABLE: 'NIE DOTYCZY',
};

export const YES_NO_LABELS: Record<YesNo, string> = { YES: 'TAK', NO: 'NIE' };

export const EMPLOYMENT_LABELS: Record<EmploymentType, string> = {
  CIVIL_SERVICE_EMPLOYEE: 'pracownik służby cywilnej',
  CIVIL_SERVANT: 'urzędnik służby cywilnej',
};

export const CONTRACT_LABELS: Record<ContractType, string> = {
  DEFINITE_12M: 'umowa na czas określony 12 miesięcy',
  SUBSTITUTION: 'umowa na zastępstwo',
  INDEFINITE: 'umowa na czas nieokreślony',
};

export const SUBORDINATES_LABELS: Record<Subordinates, string> = {
  NONE: 'brak podległych pracowników',
  UP_TO_4: 'bezpośrednio kieruje lub koordynuje pracę do 4 pracowników',
  FROM_5_TO_9: 'bezpośrednio kieruje lub koordynuje pracę od 5 do 9 pracowników',
  ABOVE_9: 'bezpośrednio kieruje lub koordynuje pracę powyżej 9 pracowników',
  MANAGERS_SUBORDINATE: 'bezpośrednio podlegają osoby kierujące pracą innych pracowników',
};

export const REMINDER_LABELS: Record<ReminderType, string> = {
  INITIAL_TALK_DUE: 'Termin rozmowy wstępnej / rozpoczynającej',
  REPORT_DUE: 'Termin sprawozdania',
  EVALUATION_DUE: 'Termin oceny',
  MANUAL_HR: 'Przypomnienie od HR',
};

export const COMPETENCY_LABELS: Record<CompetencyCode, string> = {
  KOMUNIKACJA: 'Komunikacja',
  KREATYWNOSC: 'Kreatywność',
  NEGOCJOWANIE: 'Negocjowanie',
  ORGANIZACJA_PRACY: 'Organizacja pracy i orientacja na osiąganie celów',
  ORIENTACJA_NA_KLIENTA: 'Orientacja na klienta/interesanta',
  PODEJMOWANIE_DECYZJI: 'Podejmowanie decyzji i odpowiedzialność',
  SYTUACJE_KRYZYSOWE: 'Radzenie sobie w sytuacjach kryzysowych',
  RZETELNOSC: 'Rzetelność',
  MYSLENIE_ANALITYCZNE: 'Myślenie analityczne',
  WYKORZYSTYWANIE_WIEDZY: 'Wykorzystywanie wiedzy i doskonalenie zawodowe',
  WSPOLPRACA: 'Współpraca',
  WYSTAPIENIA_PUBLICZNE: 'Wystąpienia publiczne',
  ZARZADZANIE_LUDZMI: 'Zarządzanie ludźmi',
  ZARZADZANIE_STRATEGICZNE: 'Zarządzanie strategiczne',
};

/** Polish decimal format with 2 places, e.g. 5,83 (docs/02 § 1.5). */
export function formatAverage(x: number | null | undefined): string {
  if (x === null || x === undefined) return '—';
  return (Math.round((x + Number.EPSILON) * 100) / 100).toFixed(2).replace('.', ',');
}
