import { describe, expect, it } from 'vitest';
import { COMPETENCIES } from './competencies';
import { DEMO_EMPLOYEES, DEMO_USERS, buildDemoEvaluations } from './demo';
import {
  acknowledge,
  blockingIssues,
  buildNewEvaluation,
  completeEvaluation,
  completionIssues,
  firstDeadlineIssues,
  initialTalkIssues,
  recalc,
  setAdditionalCriteria,
  switchForm,
  toTracking,
} from './evaluation';
import type { Evaluation, Score } from './types';

const emp = (id: string) => DEMO_EMPLOYEES.find((e) => e.id === id)!;
const marta = DEMO_USERS[0];
const NOW = '2026-11-21T08:00:00.000Z';

function fill(ev: Evaluation, scores: Score[]): Evaluation {
  return recalc({
    ...ev,
    // path A: the initial talk within 21 days of hiring (emp_mazur hired 2026-02-02)
    deadlines: { ...ev.deadlines, initialTalkDate: ev.type === 'FIRST_EVALUATION' ? '2026-02-16' : '2025-01-02', finalTalkDate: '2026-11-20' },
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

describe('periodic deadline base (§ 7 pkt 1 rozp. 2016, art. 81 ust. 4)', () => {
  const first = { ...emp('emp_wojcik'), hireDate: '2021-03-01', indefiniteEmploymentDate: '2022-03-01', lastPeriodicEvaluation: null, absences: [] };

  it('first periodic evaluation counts from the indefinite employment, not from the first 12-month contract', () => {
    const ev = buildNewEvaluation({ id: 'x', employee: first, supervisor: marta, now: NOW });
    expect(ev.deadlines.initialTalkDue).toBe('2022-03-31');
    expect(ev.deadlines.evaluationDueDate).toBe('2024-03-01');
  });

  it('a previous evaluation drawn up in writing takes precedence', () => {
    const ev = buildNewEvaluation({
      id: 'x',
      employee: { ...first, lastPeriodicEvaluation: { result: 'POSITIVE', level: 'MEETS_EXPECTATIONS', date: '2024-02-15' } },
      supervisor: marta,
      now: NOW,
    });
    expect(ev.deadlines.evaluationDueDate).toBe('2026-02-15');
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

describe('path A dates set at the initial talk (§ 3–§ 4 rozp. 2015, art. 38 ust. 1)', () => {
  // emp_mazur: hired 2026-02-02 → talk due 2026-02-23, report/evaluation from 2026-10-03, evaluation until 2027-01-01
  const mazur = emp('emp_mazur');
  const base = buildNewEvaluation({ id: 'a', employee: mazur, supervisor: marta, now: NOW });
  const TODAY = '2026-11-22';
  const withDates = (d: Partial<Evaluation['deadlines']>) => ({ ...base, deadlines: { ...base.deadlines, initialTalkDate: '2026-02-16', ...d } });
  const msgs = (ev: Evaluation) => firstDeadlineIssues(ev, mazur, TODAY);

  it('default deadlines with a timely talk are valid', () => {
    expect(base.deadlines).toMatchObject({ reportDueFrom: '2026-10-03', reportDueTo: '2026-10-17', evaluationWindowFrom: '2026-10-03', evaluationWindowTo: '2027-01-01' });
    expect(msgs(withDates({}))).toEqual([]);
    expect(blockingIssues(initialTalkIssues(withDates({}), mazur, TODAY))).toEqual([]);
  });

  it('the screenshot case: talk in the future, report before the talk, inverted evaluation window beyond the limit', () => {
    const ev = withDates({ initialTalkDate: '2026-12-31', evaluationWindowFrom: '2027-01-15', evaluationWindowTo: '2026-11-04' });
    const text = msgs(ev).map((i) => i.message).join(' | ');
    expect(text).toMatch(/w przyszłości/);
    expect(text).toMatch(/sprawozdania wypada przed rozmową wstępną/);
    expect(text).toMatch(/Okres dokonania pierwszej oceny: data początkowa jest późniejsza niż końcowa/);
    expect(msgs(ev).every((i) => i.severity === undefined)).toBe(true); // all blocking
    // each message is attached to its field (shown as a popup next to it)
    expect(new Set(msgs(ev).map((i) => i.field))).toEqual(new Set(['initialTalkDate', 'reportDue', 'evaluationWindow']));
  });

  it('missing values are flagged as such and attached to their fields', () => {
    const empty = { ...base, deadlines: { ...base.deadlines, initialTalkDate: null, reportDueFrom: null, evaluationWindowTo: null } };
    const missing = initialTalkIssues(empty, mazur, TODAY).filter((i) => i.missing);
    expect(missing.map((i) => i.field).sort()).toEqual(['evaluationWindow', 'initialTalkDate', 'reportDue']);
  });

  it('a late talk is only a warning (cannot be undone), a talk before hiring is an error', () => {
    const late = msgs(withDates({ initialTalkDate: '2026-03-10' }));
    expect(late).toHaveLength(1);
    expect(late[0]).toMatchObject({ severity: 'warning' });
    expect(late[0].message).toMatch(/po terminie 21 dni \(termin: 23\.02\.2026/);
    expect(blockingIssues(late)).toEqual([]);
    expect(msgs(withDates({ initialTalkDate: '2026-01-20' }))[0].message).toMatch(/wcześniejsza niż nawiązanie stosunku pracy/);
  });

  it('report window: after 8 months, ordered, and leaving time for the evaluation', () => {
    expect(msgs(withDates({ reportDueFrom: '2026-10-02' }))[0].message).toMatch(/najwcześniej 03\.10\.2026/);
    expect(msgs(withDates({ reportDueFrom: '2026-10-20', reportDueTo: '2026-10-10' }))[0].message).toMatch(/początkowa jest późniejsza/);
    const late = msgs(withDates({ reportDueTo: '2027-01-05' })).map((i) => i.message).join(' | ');
    expect(late).toMatch(/sprawozdanie najpóźniej 01\.01\.2027/);
  });

  it('evaluation window: within 8 months … 1 month before the contract ends, not before the report', () => {
    expect(msgs(withDates({ evaluationWindowFrom: '2026-09-30' }))[0].message).toMatch(/od 03\.10\.2026/);
    expect(msgs(withDates({ evaluationWindowTo: '2027-01-15' }))[0].message).toMatch(/do 01\.01\.2027/);
    expect(msgs(withDates({ evaluationWindowTo: '2026-10-10' })).map((i) => i.message).join(' ')).toMatch(/sprawozdania kończy się po okresie dokonania oceny/);
  });

  it('periodic evaluations are not affected', () => {
    const periodic = buildNewEvaluation({ id: 'p', employee: emp('emp_wojcik'), supervisor: marta, now: NOW });
    expect(firstDeadlineIssues(periodic, emp('emp_wojcik'), TODAY)).toEqual([]);
  });
});
