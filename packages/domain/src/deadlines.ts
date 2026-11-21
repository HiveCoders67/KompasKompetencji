import { daysBetween, formatPL, minDate, plusDays, plusMonths } from './dates';
import type { Absence, DateOnly } from './types';

/*
 * Statutory deadlines — docs/02 § 1.6 (periodic) and § 2.4 (first evaluation).
 * Pure functions on DateOnly strings.
 */

/** Days of an absence, both ends inclusive. */
export const absenceDays = (a: Absence): number => daysBetween(a.from, a.to) + 1;

/** Absence lasting longer than `months` calendar months (e.g. 01.03–01.04 = 1 month and 1 day). */
export const absenceLongerThanMonths = (a: Absence, months: number): boolean => a.to >= plusMonths(a.from, months);

// ------------------------------------------------------------------ path B

export interface PeriodicDeadlines {
  initialTalkDue: DateOnly;
  evaluationDueDate: DateOnly;
  extensionDays: number;
  notes: string[];
}

/**
 * 24 months from the previous evaluation / indefinite employment; initial talk within 30 days.
 * Art. 81 ust. 7: every uninterrupted justified absence longer than one month extends the
 * 24-month deadline by its duration. Shorter absences do not.
 */
export function periodicDeadlines(baseDate: DateOnly, absences: Absence[] = []): PeriodicDeadlines {
  const notes: string[] = [];
  let extensionDays = 0;
  for (const a of absences) {
    const days = absenceDays(a);
    if (absenceLongerThanMonths(a, 1)) {
      extensionDays += days;
      notes.push(`Nieobecność ${formatPL(a.from)}–${formatPL(a.to)} (${days} dni) wydłuża termin oceny (art. 81 ust. 7 ustawy).`);
    } else {
      notes.push(`Nieobecność ${formatPL(a.from)}–${formatPL(a.to)} (${days} dni) nie przekracza miesiąca — bez wpływu na termin.`);
    }
  }
  return {
    initialTalkDue: plusDays(baseDate, 30),
    evaluationDueDate: plusDays(plusMonths(baseDate, 24), extensionDays),
    extensionDays,
    notes,
  };
}

/**
 * After a negative evaluation (art. 81 ust. 9, § 7 pkt 2 rozp. 2016): re-evaluation right after the day on
 * which 6 months from acknowledgement pass (15.02 → 16.08); initial talk and criteria within 7 days of
 * drawing up the negative evaluation. NOT extended by absences (art. 81 ust. 7) and NOT changeable under
 * art. 81 ust. 8 — both apply only to the 24-month deadline (Poradnik KPRM – Oceny okresowe, s. 13).
 */
export function afterNegativeDeadlines(negativeDrawnUpOn: DateOnly, acknowledgedOn: DateOnly) {
  return {
    initialTalkDue: plusDays(negativeDrawnUpOn, 7),
    evaluationDueDate: plusDays(plusMonths(acknowledgedOn, 6), 1),
  };
}

export type DeadlineChangeReason =
  | 'EVALUATOR_CHANGED'
  | 'EMPLOYEE_ABSENCE_EXPECTED'
  | 'EVALUATOR_ABSENCE_EXPECTED'
  | 'EMPLOYEE_REQUEST';

/**
 * Art. 81 ust. 8: the evaluator may change the 24-month deadline for one of 4 reasons, provided more than
 * 6 months have passed since the last evaluation (first periodic evaluation: the assessed period > 6 months).
 * Never applies to a re-evaluation after a negative one.
 */
export function canChangeDeadline(referenceDate: DateOnly, onDate: DateOnly, isReEvaluationAfterNegative: boolean): boolean {
  return !isReEvaluationAfterNegative && onDate > plusMonths(referenceDate, 6);
}

export type PositionChangeOutcome =
  | { kind: 'EARLY_EVALUATION'; from: DateOnly; to: DateOnly; explanation: string }
  | { kind: 'NEW_CRITERIA'; initialTalkDue: DateOnly; explanation: string };

/** Position change with a significant change of duties (art. 81 ust. 6, § 9 rozp. 2016). */
export function positionChange(lastReference: DateOnly, changeDate: DateOnly): PositionChangeOutcome {
  if (changeDate > plusMonths(lastReference, 6)) {
    return {
      kind: 'EARLY_EVALUATION',
      from: plusDays(changeDate, -7),
      to: plusDays(changeDate, 30),
      explanation:
        'Minęło ponad 6 miesięcy — obowiązkowa wcześniejsza ocena: nie wcześniej niż 7 dni przed zmianą i nie później niż 30 dni po zmianie (art. 81 ust. 6, § 9 ust. 2 rozp.).',
    };
  }
  return {
    kind: 'NEW_CRITERIA',
    initialTalkDue: plusDays(changeDate, 30),
    explanation: 'Minęło nie więcej niż 6 miesięcy — ponowna rozmowa i wybór kryteriów w ciągu 30 dni; termin oceny bez zmian.',
  };
}

/** Objection deadline (art. 83 ust. 1): 7 days from acknowledgement. */
export const objectionDeadline = (acknowledgedOn: DateOnly): DateOnly => plusDays(acknowledgedOn, 7);

// ------------------------------------------------------------------ path A

export interface FirstDeadlines {
  initialTalkDue: DateOnly;
  preparatoryServiceEndLatest: DateOnly;
  reportDueFrom: DateOnly;
  reportDueTo: DateOnly;
  evaluationWindowFrom: DateOnly;
  evaluationWindowTo: DateOnly;
  contractEnd: DateOnly;
}

/**
 * 12-month contract (art. 35 ust. 3): initial talk within 21 days; evaluation not earlier than after 8 months
 * and not later than one month before the contract ends (art. 38 ust. 1). The report deadline falls after
 * 8 months (§ 4 ust. 1 rozp. 2015) — by default a two-week window, editable by the supervisor.
 */
export function firstEvaluationDeadlines(hireDate: DateOnly, contractExtensionDays = 0): FirstDeadlines {
  const contractEnd = plusDays(plusDays(plusMonths(hireDate, 12), -1), contractExtensionDays);
  const after8 = plusDays(plusMonths(hireDate, 8), 1);
  const evaluationWindowTo = plusMonths(contractEnd, -1);
  return {
    initialTalkDue: plusDays(hireDate, 21),
    preparatoryServiceEndLatest: plusMonths(hireDate, 8),
    reportDueFrom: after8,
    reportDueTo: minDate(plusDays(after8, 14), evaluationWindowTo),
    evaluationWindowFrom: after8,
    evaluationWindowTo,
    contractEnd,
  };
}

/** The report must cover at least 7 months of work (§ 6 ust. 1 rozp. 2015). */
export const reportCoversMinimumPeriod = (hireDate: DateOnly, reportDate: DateOnly): boolean =>
  reportDate >= plusMonths(hireDate, 7);

/**
 * § 5 ust. 1 and 3 rozp. 2015: a new report deadline after a justified absence — extended by the
 * absence period, but so that the evaluation can still take place one month before the contract ends.
 */
export function extendReportDeadline(reportDueTo: DateOnly, absence: Absence, evaluationWindowTo: DateOnly): DateOnly {
  return minDate(plusDays(reportDueTo, absenceDays(absence)), evaluationWindowTo);
}

export const isWithin = (d: DateOnly, from: DateOnly, to: DateOnly): boolean => d >= from && d <= to;

// ------------------------------------------------------- deadline state (UI)

export type DeadlineState = 'OVERDUE' | 'SOON' | 'OK' | 'DONE';

export function deadlineState(due: DateOnly, onDate: DateOnly, done: boolean, soonDays = 14): DeadlineState {
  if (done) return 'DONE';
  const left = daysBetween(onDate, due);
  if (left < 0) return 'OVERDUE';
  if (left <= soonDays) return 'SOON';
  return 'OK';
}
