import { describe, expect, it } from 'vitest';
import { buildDemoEvaluations, DEMO_EMPLOYEES } from './demo';
import { decode, encode, type FirestoreAdapter } from './firestoreCodec';

class Ref { constructor(public path: string, public id: string) {} }
class Ts { constructor(public d: Date) {} toDate() { return this.d; } }
const fs: FirestoreAdapter = {
  ref: (c, id) => new Ref(`${c}/${id}`, id),
  isRef: (v): v is Ref => v instanceof Ref,
  timestamp: (d) => new Ts(d),
  isTimestamp: (v): v is Ts => v instanceof Ts,
};

describe('Firestore codec', () => {
  it('refs, calendar dates at 00:00 Warsaw and instants; round-trips', () => {
    const ev = buildDemoEvaluations()[2];
    const data = encode(fs, ev) as any;
    expect(data.id).toBeUndefined();
    expect(data.supervisorId).toEqual(new Ref('users/sup_dwm', 'sup_dwm'));
    expect(data.criteriaAssessments[0].competencyId.path).toBe('competencies/ZARZADZANIE_LUDZMI');
    expect(data.deadlines.acknowledgedAt.toDate().toISOString()).toBe('2025-01-15T23:00:00.000Z');
    expect(data.summary.computedAt.toDate().toISOString()).toBe('2025-01-15T10:00:00.000Z');
    expect(decode(fs, data, ev.id)).toEqual(ev);
  });
  it('employee absences and hire date', () => {
    const e = DEMO_EMPLOYEES[0];
    const data = encode(fs, e) as any;
    expect(data.absences[0].from).toBeInstanceOf(Ts);
    expect(data.employeeId).toBeUndefined();
    expect(decode(fs, data, e.id)).toEqual(e);
  });
});
