import type { ExamPassed, FinalResult, OverallLevel, Score, YesNo } from './types';

/*
 * Deterministic result logic — docs/02 § 1.5 and § 2.3. The only place where results are computed;
 * shared by the UI and the `completeEvaluation` Cloud Function. Thresholds are compared on integers
 * (`sum > 4·n`), never on a rounded average.
 */

export const sum = (scores: number[]): number => scores.reduce((a, b) => a + b, 0);

/** Exact average for display/storage (rounded to 2 places only when presented). */
export function averageScore(scores: number[]): number {
  if (scores.length === 0) throw new Error('Brak ocen cząstkowych.');
  return sum(scores) / scores.length;
}

/** Overall level of meeting the criteria (periodic evaluation), integer comparison on S and n. */
export function periodicOverallLevel(scores: Score[]): OverallLevel {
  const n = scores.length;
  if (n < 5 || n > 8) throw new Error(`Ocena okresowa obejmuje 5–8 kryteriów (jest ${n}).`);
  const s = sum(scores);
  if (s <= 2 * n) return 'FAR_BELOW_EXPECTATIONS';
  if (s <= 4 * n) return 'BELOW_EXPECTATIONS';
  if (s <= 6 * n) return 'MEETS_EXPECTATIONS';
  if (s <= 8 * n) return 'ABOVE_EXPECTATIONS';
  return 'FAR_ABOVE_EXPECTATIONS';
}

export interface PeriodicResult {
  averageScore: number;
  overallLevel: OverallLevel;
  finalResult: FinalResult;
  reasons: string[];
}

/** POSITIVE ⇔ S > 4n and no partial score of 1 (§ 11 ust. 1 pkt 1–4 rozp. 2016). */
export function computePeriodicResult(scores: Score[]): PeriodicResult {
  const n = scores.length;
  const overallLevel = periodicOverallLevel(scores);
  const s = sum(scores);
  const reasons: string[] = [];
  if (s <= 4 * n) reasons.push('Średnia ocen cząstkowych nie przekracza 4 punktów (§ 11 ust. 1 pkt 4 rozp. z 2016 r.).');
  if (scores.includes(1)) {
    reasons.push('Co najmniej jedna ocena cząstkowa „znacznie poniżej oczekiwań” (1 pkt) oznacza ocenę negatywną (§ 11 ust. 1 pkt 4 rozp. z 2016 r.).');
  }
  return { averageScore: s / n, overallLevel, finalResult: reasons.length ? 'NEGATIVE' : 'POSITIVE', reasons };
}

export interface FirstResult {
  averageScore: number;
  finalResult: FinalResult;
  conditions: { label: string; met: boolean }[];
}

/** First evaluation — all 4 conditions of § 10 ust. 1 rozp. 2015 must hold (§ 10 ust. 2). */
export function computeFirstResult(scores: Score[], examPassed: ExamPassed, reportSubmittedOnTime: YesNo): FirstResult {
  if (scores.length !== 5) throw new Error('Pierwsza ocena obejmuje dokładnie 5 elementów.');
  if (scores.some((x) => x !== 3 && x !== 5 && x !== 7)) throw new Error('Skala pierwszej oceny: 3, 5 lub 7 pkt.');
  const s = sum(scores);
  const conditions = [
    { label: 'Egzamin ze służby przygotowawczej zaliczony albo nie dotyczy (§ 10 ust. 1 pkt 1, ust. 3)', met: examPassed !== 'NO' },
    { label: 'Sprawozdanie złożone w wyznaczonym terminie (§ 10 ust. 1 pkt 2)', met: reportSubmittedOnTime === 'YES' },
    { label: 'Nie więcej niż jedna ocena cząstkowa 3 pkt (§ 10 ust. 1 pkt 3)', met: scores.filter((x) => x === 3).length <= 1 },
    { label: 'Ocena łączna nie niższa niż 5 pkt (§ 10 ust. 1 pkt 4)', met: s >= 25 },
  ];
  return { averageScore: s / 5, finalResult: conditions.every((c) => c.met) ? 'POSITIVE' : 'NEGATIVE', conditions };
}
