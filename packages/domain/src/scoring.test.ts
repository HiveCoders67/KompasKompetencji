import { describe, expect, it } from 'vitest';
import { computeFirstResult, computePeriodicResult, periodicOverallLevel } from './scoring';
import { validateAdditionalCriteria } from './forms';
import { formatAverage } from './labels.pl';
import type { Score } from './types';

describe('periodic evaluation — result (§ 11 rozp. 2016)', () => {
  it('average 5.8 with one „1” → NEGATIVE (docs/03 jury case)', () => {
    const r = computePeriodicResult([1, 7, 7, 7, 7]);
    expect(r.averageScore).toBeCloseTo(5.8);
    expect(formatAverage(r.averageScore)).toBe('5,80');
    expect(r.overallLevel).toBe('MEETS_EXPECTATIONS');
    expect(r.finalResult).toBe('NEGATIVE');
    expect(r.reasons.join(' ')).toMatch(/1 pkt/);
  });

  it('S = 4n exactly → NEGATIVE; S = 4n + 2 → POSITIVE', () => {
    expect(computePeriodicResult([3, 3, 3, 5, 5, 5]).finalResult).toBe('NEGATIVE');
    expect(computePeriodicResult([3, 5, 5, 5, 3]).finalResult).toBe('POSITIVE'); // 21 > 20
  });

  it('integer thresholds S vs k·n (no rounding before classification)', () => {
    expect(periodicOverallLevel([7, 7, 7, 5, 5, 5])).toBe('MEETS_EXPECTATIONS'); // 36 = 6·6
    expect(periodicOverallLevel([7, 7, 7, 7, 5, 5])).toBe('ABOVE_EXPECTATIONS'); // 38 > 36
    expect(periodicOverallLevel([5, 5, 5, 5, 3, 3, 3, 3])).toBe('BELOW_EXPECTATIONS'); // 32 = 4·8
    expect(periodicOverallLevel([5, 5, 5, 5, 5, 3, 3, 3])).toBe('MEETS_EXPECTATIONS'); // 34 > 32
    expect(computePeriodicResult([5, 5, 5, 5, 3, 3, 3, 3]).finalResult).toBe('NEGATIVE');
  });

  it('level boundaries on S and n', () => {
    expect(periodicOverallLevel([1, 1, 3, 3, 1])).toBe('FAR_BELOW_EXPECTATIONS'); // 9 ≤ 10
    expect(periodicOverallLevel([3, 3, 3, 1, 1] as Score[])).toBe('BELOW_EXPECTATIONS'); // 11 ≤ 20
    expect(periodicOverallLevel([5, 5, 5, 5, 5])).toBe('MEETS_EXPECTATIONS'); // 25 ≤ 30
    expect(periodicOverallLevel([7, 7, 7, 7, 3])).toBe('ABOVE_EXPECTATIONS'); // 31
    expect(periodicOverallLevel([9, 9, 9, 7, 7])).toBe('FAR_ABOVE_EXPECTATIONS'); // 41 > 40
    expect(periodicOverallLevel([9, 9, 7, 7, 7, 9, 9, 9])).toBe('FAR_ABOVE_EXPECTATIONS'); // 66 > 64
  });

  it('accepts 5–8 criteria only', () => {
    expect(() => computePeriodicResult([5, 5, 5, 5])).toThrow();
    expect(() => computePeriodicResult([5, 5, 5, 5, 5, 5, 5, 5, 5])).toThrow();
  });
});

describe('first evaluation — result (§ 10 rozp. 2015)', () => {
  it('3,5,5,5,7 + exam + report → POSITIVE (docs/03 jury case)', () => {
    const r = computeFirstResult([3, 5, 5, 5, 7], 'YES', 'YES');
    expect(r.averageScore).toBe(5);
    expect(r.finalResult).toBe('POSITIVE');
  });
  it('two „3” → NEGATIVE even with a high average', () => {
    expect(computeFirstResult([3, 3, 7, 7, 7], 'YES', 'YES').finalResult).toBe('NEGATIVE');
  });
  it('sum 24 (< 25) → NEGATIVE', () => {
    expect(computeFirstResult([3, 5, 5, 5, 5], 'YES', 'YES').finalResult).toBe('NEGATIVE');
  });
  it('exam failed or report late → NEGATIVE; NOT_APPLICABLE counts as met', () => {
    expect(computeFirstResult([7, 7, 7, 7, 7], 'NO', 'YES').finalResult).toBe('NEGATIVE');
    expect(computeFirstResult([7, 7, 7, 7, 7], 'YES', 'NO').finalResult).toBe('NEGATIVE');
    expect(computeFirstResult([5, 5, 5, 5, 5], 'NOT_APPLICABLE', 'YES').finalResult).toBe('POSITIVE');
  });
  it('rejects values outside 3/5/7', () => {
    expect(() => computeFirstResult([1, 5, 5, 5, 5], 'YES', 'YES')).toThrow();
  });
});

describe('additional criteria', () => {
  it('0–3, no duplicates, no mandatory ones', () => {
    expect(validateAdditionalCriteria('FORM_C', [])).toEqual([]);
    expect(validateAdditionalCriteria('FORM_C', ['MYSLENIE_ANALITYCZNE', 'KREATYWNOSC', 'NEGOCJOWANIE'])).toEqual([]);
    expect(validateAdditionalCriteria('FORM_C', ['MYSLENIE_ANALITYCZNE', 'KREATYWNOSC', 'NEGOCJOWANIE', 'SYTUACJE_KRYZYSOWE'])).not.toEqual([]);
    expect(validateAdditionalCriteria('FORM_C', ['RZETELNOSC'])).not.toEqual([]);
    expect(validateAdditionalCriteria('FORM_B', ['RZETELNOSC'])).toEqual([]);
    expect(validateAdditionalCriteria('FIRST', ['KREATYWNOSC'])).not.toEqual([]);
  });
});
