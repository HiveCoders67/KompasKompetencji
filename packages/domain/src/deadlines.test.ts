import { describe, expect, it } from 'vitest';
import { fromDateOnly, plusMonths, toDateOnly, today } from './dates';
import {
  afterNegativeDeadlines,
  canChangeDeadline,
  extendReportDeadline,
  firstEvaluationDeadlines,
  objectionDeadline,
  periodicDeadlines,
  positionChange,
  reportCoversMinimumPeriod,
} from './deadlines';

describe('calendar dates (Europe/Warsaw)', () => {
  it('toDateOnly → 00:00 Warsaw (winter UTC+1, summer UTC+2), round-trips', () => {
    expect(toDateOnly('2026-01-15').toISOString()).toBe('2026-01-14T23:00:00.000Z');
    expect(toDateOnly('2026-07-15').toISOString()).toBe('2026-07-14T22:00:00.000Z');
    expect(fromDateOnly(toDateOnly('2026-03-29'))).toBe('2026-03-29');
    expect(today(new Date('2026-11-20T23:30:00Z'))).toBe('2026-11-21');
  });
  it('month arithmetic: 31.01 + 1 month = last day of February', () => {
    expect(plusMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(plusMonths('2028-01-31', 1)).toBe('2028-02-29');
  });
  it('rejects malformed dates', () => {
    expect(() => toDateOnly('2026-02-30')).toThrow();
  });
});

describe('periodic deadlines (docs/02 § 1.6)', () => {
  it('24 months, initial talk within 30 days', () => {
    expect(periodicDeadlines('2024-12-02')).toMatchObject({ initialTalkDue: '2025-01-01', evaluationDueDate: '2026-12-02' });
  });
  it('sick leave of 44 days in a row extends by 44 days (art. 81 ust. 7; Poradnik KPRM example)', () => {
    // Poradnik: due 08.05.2015, 44 days of absence → 21.06.2015
    const d = periodicDeadlines('2013-05-08', [{ from: '2014-11-10', to: '2014-12-23' }]);
    expect(d.extensionDays).toBe(44);
    expect(d.evaluationDueDate).toBe('2015-06-21');
  });
  it('absence not longer than a month does not extend', () => {
    expect(periodicDeadlines('2024-12-02', [{ from: '2025-03-01', to: '2025-03-31' }]).extensionDays).toBe(0);
  });
  it('re-evaluation after negative: right after 6 months (15.02 → 16.08), talk within 7 days', () => {
    expect(afterNegativeDeadlines('2026-02-10', '2026-02-15')).toEqual({ initialTalkDue: '2026-02-17', evaluationDueDate: '2026-08-16' });
  });
  it('art. 81 ust. 8 change only after > 6 months and never for re-evaluation after negative', () => {
    expect(canChangeDeadline('2026-01-10', '2026-07-11', false)).toBe(true);
    expect(canChangeDeadline('2026-01-10', '2026-07-10', false)).toBe(false);
    expect(canChangeDeadline('2026-01-10', '2026-09-10', true)).toBe(false);
  });
  it('position change (art. 81 ust. 6)', () => {
    expect(positionChange('2026-01-01', '2026-08-01')).toMatchObject({ kind: 'EARLY_EVALUATION', from: '2026-07-25', to: '2026-08-31' });
    expect(positionChange('2026-01-01', '2026-05-01')).toMatchObject({ kind: 'NEW_CRITERIA', initialTalkDue: '2026-05-31' });
  });
  it('objection: 7 days from acknowledgement (art. 83 ust. 1)', () => {
    expect(objectionDeadline('2026-11-20')).toBe('2026-11-27');
  });
});

describe('first evaluation deadlines (docs/02 § 2.4)', () => {
  const d = firstEvaluationDeadlines('2026-02-02');
  it('initial talk within 21 days, window after 8 months until 1 month before contract end', () => {
    expect(d.initialTalkDue).toBe('2026-02-23');
    expect(d.contractEnd).toBe('2027-02-01');
    expect(d.evaluationWindowFrom).toBe('2026-10-03');
    expect(d.evaluationWindowTo).toBe('2027-01-01');
    expect(d.reportDueFrom).toBe('2026-10-03');
  });
  it('report covers at least 7 months (§ 6 ust. 1)', () => {
    expect(reportCoversMinimumPeriod('2026-02-02', '2026-09-02')).toBe(true);
    expect(reportCoversMinimumPeriod('2026-02-02', '2026-09-01')).toBe(false);
  });
  it('report deadline extended by absence, capped by the evaluation window (§ 5)', () => {
    expect(extendReportDeadline('2026-10-17', { from: '2026-05-01', to: '2026-05-20' }, d.evaluationWindowTo)).toBe('2026-11-06');
    expect(extendReportDeadline('2026-12-20', { from: '2026-05-01', to: '2026-06-30' }, d.evaluationWindowTo)).toBe('2027-01-01');
  });
});
