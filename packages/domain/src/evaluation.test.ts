import { describe, expect, it } from 'vitest';
import { COMPETENCIES } from './competencies';
import { DEMO_EMPLOYEES, DEMO_USERS, buildDemoEvaluations } from './demo';
import { acknowledge, buildNewEvaluation, completeEvaluation, completionIssues, recalc, setAdditionalCriteria, switchForm, toTracking } from './evaluation';
import type { Evaluation, Score } from './types';

const emp = (id: string) => DEMO_EMPLOYEES.find((e) => e.id === id)!;
const marta = DEMO_USERS[0];
const NOW = '2026-11-21T08:00:00.000Z';

function fill(ev: Evaluation, scores: Score[]): Evaluation {
  return recalc({
    ...ev,
    deadlines: { ...ev.deadlines, initialTalkDate: '2025-01-02', finalTalkDate: '2026-11-20' },
    criteriaAssessments: ev.criteriaAssessments.map((c, i) => ({ ...c, finalScore: scores[i] })),
  });
}

describe('competency model (xlsx)', () => {
  it('14 competencies, 49 indicators, 5 levels each', () => {
    expect(COMPETENCIES).toHaveLength(14);
    expect(COMPETENCIES.flatMap((c) => c.indicators)).toHaveLength(49);
    expect(COMPETENCIES.every((c) => c.indicators.every((i) => i.behaviors.map((b) => b.level).join() === '1,3,5,7,9'))).toBe(true);
  });
});

describe('evaluation workflow', () => {
  it('new periodic evaluation: form C, 5 mandatory criteria, all indicators preselected', () => {
    const ev = buildNewEvaluation({ id: 'x', employee: emp('emp_wojcik'), supervisor: marta, now: NOW });
    expect(ev.formType).toBe('FORM_C');
    expect(ev.criteriaAssessments.map((c) => c.competencyId)).toEqual(['WYKORZYSTYWANIE_WIEDZY', 'RZETELNOSC', 'ORGANIZACJA_PRACY', 'WSPOLPRACA', 'KOMUNIKACJA']);
    expect(ev.criteriaAssessments.every((c) => c.indicatorAssessments.every((i) => i.selected))).toBe(true);
    // 44-day absence (> 1 month) extends the 24-month deadline from 02.12.2026
    expect(ev.deadlines.evaluationDueDate).toBe('2027-01-15');
  });

  it('switching C → B keeps shared criteria and drops additional ones that become mandatory', () => {
    let ev = buildNewEvaluation({ id: 'x', employee: emp('emp_wojcik'), supervisor: marta, now: NOW });
    ev = setAdditionalCriteria(ev, ['ZARZADZANIE_LUDZMI', 'KREATYWNOSC']);
    const b = switchForm(ev, 'FORM_B');
    expect(b.criteriaAssessments.filter((c) => c.isMandatory).map((c) => c.competencyId)).toContain('ZARZADZANIE_LUDZMI');
    expect(b.criteriaAssessments.filter((c) => !c.isMandatory).map((c) => c.competencyId)).toEqual(['KREATYWNOSC']);
  });

  it('negative periodic evaluation requires a justification; IPRZ always required', () => {
    const ev = fill(buildNewEvaluation({ id: 'x', employee: emp('emp_wojcik'), supervisor: marta, now: NOW }), [1, 7, 7, 7, 7]);
    const msgs = completionIssues(ev, emp('emp_wojcik')).map((i) => i.message).join(' ');
    expect(msgs).toMatch(/Uzasadnienie jest obowiązkowe/);
    expect(msgs).toMatch(/programu rozwoju/);
  });

  it('completeEvaluation computes the summary with domain functions; acknowledgement sets objection deadline', () => {
    let ev = fill(buildNewEvaluation({ id: 'x', employee: emp('emp_wojcik'), supervisor: marta, now: NOW }), [5, 5, 7, 5, 5]);
    ev = { ...ev, texts: { ...ev.texts, developmentPlan: 'Szkolenie z analizy ryzyka.' } };
    const done = completeEvaluation(ev, emp('emp_wojcik'), '2026-11-21', NOW);
    expect(done.status).toBe('COMPLETED');
    expect(done.summary).toMatchObject({ averageScore: 5.4, overallLevel: 'MEETS_EXPECTATIONS', finalResult: 'POSITIVE' });
    expect(done.deadlines.periodTo).toBe('2026-11-21');
    expect(() => completeEvaluation(done, emp('emp_wojcik'), '2026-11-21', NOW)).toThrow();
    const ack = acknowledge(done, '2026-11-24', NOW);
    expect(ack.deadlines.objectionDeadline).toBe('2026-12-01');
  });

  it('first evaluation needs exam/report answers and the department head approval', () => {
    const ev = fill(buildNewEvaluation({ id: 'y', employee: emp('emp_mazur'), supervisor: marta, now: NOW }), [3, 5, 5, 5, 7]);
    const msgs = completionIssues(ev, emp('emp_mazur')).map((i) => i.message).join(' ');
    expect(msgs).toMatch(/egzamin/);
    expect(msgs).toMatch(/kierujący komórką/);
    const ok = { ...ev, firstEvalRequirements: { examPassed: 'YES' as const, reportSubmittedOnTime: 'YES' as const }, departmentHeadApprovedAt: NOW };
    expect(completeEvaluation(ok, emp('emp_mazur'), '2026-11-21', NOW).summary).toMatchObject({ averageScore: 5, finalResult: 'POSITIVE', overallLevel: null });
  });

  it('tracking projection never contains scores or the result (GDPR)', () => {
    const t = toTracking(buildDemoEvaluations()[2]);
    expect(JSON.stringify(t)).not.toMatch(/finalScore|summary|finalResult|POSITIVE|justification/);
  });

  it('demo data builds and the completed demo is acknowledged and positive', () => {
    const evs = buildDemoEvaluations();
    expect(evs.map((e) => e.status)).toEqual(['DRAFT', 'IN_PROGRESS', 'ACKNOWLEDGED', 'REPORT_SUBMITTED', 'DRAFT']);
    expect(evs[2].summary?.finalResult).toBe('POSITIVE');
    expect(evs[2].formType).toBe('FORM_B');
  });
});
