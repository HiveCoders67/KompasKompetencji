import { SCALE } from './forms';
import type { CriterionAssessment, FormType, IndicatorAssessment, Score } from './types';

/*
 * Level suggestion from behavioural indicators — docs/02 § 3.4 (deterministic, human-in-the-loop).
 * suggestedMean  = mean of levels of selected indicators (those marked „brak podstaw” are skipped);
 * suggestedScore = scale value nearest to the mean, ties resolved DOWN; null when nothing to average.
 * No special rules: a single indicator at level 1 does not force a suggestion of 1.
 */

export interface Suggestion {
  suggestedMean: number | null;
  suggestedScore: Score | null;
}

export function suggest(indicators: IndicatorAssessment[], formType: FormType): Suggestion {
  const levels = indicators.filter((i) => i.selected && i.level !== null).map((i) => i.level as number);
  if (levels.length === 0) return { suggestedMean: null, suggestedScore: null };
  const mean = levels.reduce((a, b) => a + b, 0) / levels.length;
  let best: Score = SCALE[formType][0];
  let bestDist = Infinity;
  for (const value of SCALE[formType]) {
    const dist = Math.abs(value - mean);
    if (dist < bestDist - 1e-9) {
      best = value;
      bestDist = dist;
    }
  }
  return { suggestedMean: mean, suggestedScore: best };
}

/** Warning shown when any indicator was assessed at level 1 (path B). */
export function hasLevelOneIndicator(c: CriterionAssessment): boolean {
  return c.indicatorAssessments.some((i) => i.selected && i.level === 1);
}

export const LEVEL_ONE_WARNING = 'Ocena cząstkowa 1 pkt oznacza ocenę negatywną (§ 11 ust. 1 pkt 4 rozp. z 2016 r.).';
