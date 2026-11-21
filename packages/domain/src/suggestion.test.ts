import { describe, expect, it } from 'vitest';
import { suggest } from './suggestion';
import type { IndicatorAssessment, Score } from './types';

const ia = (level: Score | null, selected = true): IndicatorAssessment => ({ indicatorId: 'X', selected, level, evidence: null });

describe('suggestion (docs/02 § 3.4)', () => {
  it('mean of selected levels, nearest scale value', () => {
    expect(suggest([ia(7), ia(7), ia(5)], 'FORM_C')).toEqual({ suggestedMean: 19 / 3, suggestedScore: 7 });
  });
  it('tie resolved down: 5 and 7 → 6.0 → 5', () => {
    expect(suggest([ia(5), ia(7)], 'FORM_B')).toEqual({ suggestedMean: 6, suggestedScore: 5 });
    expect(suggest([ia(3), ia(5)], 'FIRST')).toEqual({ suggestedMean: 4, suggestedScore: 3 });
  });
  it('skips „brak podstaw” (level null) and unselected indicators', () => {
    expect(suggest([ia(9), ia(null), ia(1, false)], 'FORM_C')).toEqual({ suggestedMean: 9, suggestedScore: 9 });
  });
  it('all „brak podstaw” → no suggestion', () => {
    expect(suggest([ia(null), ia(null)], 'FORM_C')).toEqual({ suggestedMean: null, suggestedScore: null });
  });
  it('no special rule: a single 1 does not force 1', () => {
    expect(suggest([ia(1), ia(7), ia(7), ia(7)], 'FORM_C').suggestedScore).toBe(5); // 5.5 → 5
  });
  it('path A uses only 3/5/7', () => {
    expect(suggest([ia(7), ia(7)], 'FIRST').suggestedScore).toBe(7);
  });
});
