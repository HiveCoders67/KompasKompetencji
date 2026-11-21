import { COMPETENCY_BY_CODE } from './competencies';
import { objectionDeadline, firstEvaluationDeadlines, periodicDeadlines, afterNegativeDeadlines } from './deadlines';
import { MANDATORY_CRITERIA, isScoreAllowed, validateAdditionalCriteria } from './forms';
import { resolveForm } from './osp';
import { computeFirstResult, computePeriodicResult } from './scoring';
import { suggest } from './suggestion';
import type {
  AppUser,
  CompetencyCode,
  CriterionAssessment,
  DateOnly,
  Employee,
  Evaluation,
  EvaluationStatus,
  EvaluationSummary,
  EvaluationTracking,
  FormType,
  Instant,
  Score,
} from './types';

/*
 * Evaluation workflow — statuses (docs/02 § 4), steps, validations and the completion computation
 * used by the `completeEvaluation` Cloud Function. Pure functions: callers pass `today` / `now`.
 */

// ------------------------------------------------------------------- steps

export type StepId = 'osp' | 'start' | 'report' | 'assessment' | 'final' | 'complete';

export const STEPS_B: { id: StepId; label: string }[] = [
  { id: 'osp', label: 'Analiza OSP' },
  { id: 'start', label: 'Rozpocznij ocenę' },
  { id: 'assessment', label: 'Ocena wskaźników' },
  { id: 'final', label: 'Rozmowa oceniająca i wynik' },
  { id: 'complete', label: 'Zatwierdzenie i PDF' },
];

export const STEPS_A: { id: StepId; label: string }[] = [
  { id: 'start', label: 'Rozmowa wstępna' },
  { id: 'report', label: 'Sprawozdanie' },
  { id: 'assessment', label: 'Ocena 5 elementów' },
  { id: 'final', label: 'Rozmowa oceniająca i wynik' },
  { id: 'complete', label: 'Zatwierdzenie i PDF' },
];

export const stepsFor = (ev: Pick<Evaluation, 'type'>) => (ev.type === 'FIRST_EVALUATION' ? STEPS_A : STEPS_B);

/** Path B never uses REPORT_SUBMITTED; path A never uses IN_PROGRESS (schema § 4). */
export const STATUS_ORDER: Record<'A' | 'B', EvaluationStatus[]> = {
  B: ['DRAFT', 'INITIAL_TALK_DONE', 'IN_PROGRESS', 'FINAL_TALK_DONE', 'COMPLETED', 'ACKNOWLEDGED'],
  A: ['DRAFT', 'INITIAL_TALK_DONE', 'REPORT_SUBMITTED', 'FINAL_TALK_DONE', 'COMPLETED', 'ACKNOWLEDGED'],
};

export const pathOf = (ev: Pick<Evaluation, 'type'>): 'A' | 'B' => (ev.type === 'FIRST_EVALUATION' ? 'A' : 'B');
export const statusRank = (ev: Pick<Evaluation, 'type' | 'status'>) => STATUS_ORDER[pathOf(ev)].indexOf(ev.status);
export const isLocked = (ev: Pick<Evaluation, 'status'>) => ev.status === 'COMPLETED' || ev.status === 'ACKNOWLEDGED';

// ---------------------------------------------------------------- creation

export function newCriterion(code: CompetencyCode, isMandatory: boolean): CriterionAssessment {
  return {
    competencyId: code,
    isMandatory,
    // „domyślnie wszystkie” indicators selected (docs/02 § 3.2)
    indicatorAssessments: COMPETENCY_BY_CODE[code].indicators.map((i) => ({ indicatorId: i.id, selected: true, level: null, evidence: null })),
    suggestedMean: null,
    suggestedScore: null,
    finalScore: null,
  };
}

export function criteriaFor(formType: FormType, additional: CompetencyCode[] = []): CriterionAssessment[] {
  return [
    ...MANDATORY_CRITERIA[formType].map((c) => newCriterion(c, true)),
    ...(formType === 'FIRST' ? [] : additional.map((c) => newCriterion(c, false))),
  ];
}

export const pathForEmployee = (e: Pick<Employee, 'contractType'>) =>
  e.contractType === 'INDEFINITE' ? 'PERIODIC_EVALUATION' : 'FIRST_EVALUATION';

export interface NewEvaluationInput {
  id: string;
  employee: Employee;
  supervisor: Pick<AppUser, 'uid' | 'displayName'>;
  now: Instant;
  /** Previous periodic evaluation (or indefinite employment) date — path B base date. */
  baseDate?: DateOnly;
  afterNegative?: { drawnUpOn: DateOnly; acknowledgedOn: DateOnly };
}

export function buildNewEvaluation({ id, employee, supervisor, now, baseDate, afterNegative }: NewEvaluationInput): Evaluation {
  const type = pathForEmployee(employee);
  const formType: FormType = type === 'FIRST_EVALUATION' ? 'FIRST' : (resolveForm(employee.osp) ?? employee.osp.recommendedForm);
  const empty = {
    initialTalkDate: null,
    periodFrom: null,
    periodTo: null,
    finalTalkDate: null,
    reportDueFrom: null,
    reportDueTo: null,
    reportSubmittedAt: null,
    evaluationWindowFrom: null,
    evaluationWindowTo: null,
    acknowledgedAt: null,
    objectionDeadline: null,
  };
  let deadlines: Evaluation['deadlines'];
  if (type === 'FIRST_EVALUATION') {
    const d = firstEvaluationDeadlines(employee.hireDate);
    deadlines = {
      ...empty,
      initialTalkDue: d.initialTalkDue,
      evaluationDueDate: d.evaluationWindowTo,
      reportDueFrom: d.reportDueFrom,
      reportDueTo: d.reportDueTo,
      evaluationWindowFrom: d.evaluationWindowFrom,
      evaluationWindowTo: d.evaluationWindowTo,
    };
  } else if (afterNegative) {
    deadlines = { ...empty, ...afterNegativeDeadlines(afterNegative.drawnUpOn, afterNegative.acknowledgedOn) };
  } else {
    const base = baseDate ?? employee.lastPeriodicEvaluation?.date ?? employee.hireDate;
    const d = periodicDeadlines(base, employee.absences);
    deadlines = { ...empty, initialTalkDue: d.initialTalkDue, evaluationDueDate: d.evaluationDueDate };
  }
  return {
    id,
    officeId: employee.officeId,
    type,
    formType,
    status: 'DRAFT',
    currentStep: type === 'FIRST_EVALUATION' ? 'start' : 'osp',
    isReEvaluationAfterNegative: !!afterNegative,
    employeeId: employee.id,
    employeeName: `${employee.firstName} ${employee.lastName}`,
    department: employee.osp.department,
    supervisorId: supervisor.uid,
    supervisorName: supervisor.displayName,
    previousSupervisors: [],
    departmentHeadId: employee.departmentHeadId,
    departmentHeadApprovedAt: null,
    deadlines,
    criteriaAssessments: criteriaFor(formType),
    firstEvalRequirements: type === 'FIRST_EVALUATION' ? { examPassed: null, reportSubmittedOnTime: null } : null,
    texts: { justification: null, developmentPlan: null, justificationAiDraft: false, developmentPlanAiDraft: false },
    summary: null,
    promotionRequest: {
      included: false,
      appointmentYear: null,
      currentRank: null,
      currentRankGrantedAt: null,
      requestedRank: null,
      motivation: null,
    },
    updatedAt: now,
    completedAt: null,
  };
}

// ----------------------------------------------------------------- editing

/** Recomputes suggestions; keeps everything chosen by the supervisor. */
export function recalc(ev: Evaluation): Evaluation {
  return {
    ...ev,
    criteriaAssessments: ev.criteriaAssessments.map((c) => ({ ...c, ...suggest(c.indicatorAssessments, ev.formType) })),
  };
}

/** Switching B ↔ C keeps assessments of criteria present in both and rebuilds the rest. */
export function switchForm(ev: Evaluation, formType: FormType): Evaluation {
  if (ev.formType === formType) return ev;
  const additional = ev.criteriaAssessments
    .filter((c) => !c.isMandatory && !MANDATORY_CRITERIA[formType].includes(c.competencyId))
    .map((c) => c.competencyId);
  const fresh = criteriaFor(formType, additional);
  const old = new Map(ev.criteriaAssessments.map((c) => [c.competencyId, c]));
  return recalc({
    ...ev,
    formType,
    criteriaAssessments: fresh.map((c) => (old.has(c.competencyId) ? { ...old.get(c.competencyId)!, isMandatory: c.isMandatory } : c)),
  });
}

export function setAdditionalCriteria(ev: Evaluation, codes: CompetencyCode[]): Evaluation {
  const errors = validateAdditionalCriteria(ev.formType, codes);
  if (errors.length) throw new Error(errors.join(' '));
  const kept = new Map(ev.criteriaAssessments.filter((c) => !c.isMandatory).map((c) => [c.competencyId, c]));
  return {
    ...ev,
    criteriaAssessments: [
      ...ev.criteriaAssessments.filter((c) => c.isMandatory),
      ...codes.map((code) => kept.get(code) ?? newCriterion(code, false)),
    ],
  };
}

/** Status auto-advance on editing (path B: first indicator/score → IN_PROGRESS). */
export function autoStatus(ev: Evaluation): Evaluation {
  if (
    ev.type === 'PERIODIC_EVALUATION' &&
    ev.status === 'INITIAL_TALK_DONE' &&
    ev.criteriaAssessments.some((c) => c.finalScore !== null || c.indicatorAssessments.some((i) => i.level !== null))
  ) {
    return { ...ev, status: 'IN_PROGRESS' };
  }
  return ev;
}

// ------------------------------------------------------------- validations

export interface Issue {
  step: StepId;
  message: string;
}

export function initialTalkIssues(ev: Evaluation, employee: Employee): Issue[] {
  const issues: Issue[] = [];
  if (ev.type === 'PERIODIC_EVALUATION') {
    if (resolveForm(employee.osp) === null) {
      issues.push({ step: 'osp', message: 'Potwierdź, czy praca na stanowisku polega na bezpośrednim kierowaniu pracownikami (wybór arkusza B lub C).' });
    }
    const additional = ev.criteriaAssessments.filter((c) => !c.isMandatory).map((c) => c.competencyId);
    for (const m of validateAdditionalCriteria(ev.formType, additional)) issues.push({ step: 'osp', message: m });
  } else {
    if (!ev.deadlines.reportDueFrom || !ev.deadlines.reportDueTo) issues.push({ step: 'start', message: 'Wyznacz termin na złożenie sprawozdania.' });
    if (!ev.deadlines.evaluationWindowFrom || !ev.deadlines.evaluationWindowTo) {
      issues.push({ step: 'start', message: 'Wyznacz okres, w którym powinna zostać dokonana pierwsza ocena.' });
    }
  }
  if (!ev.deadlines.initialTalkDate) {
    issues.push({ step: 'start', message: ev.type === 'FIRST_EVALUATION' ? 'Podaj datę rozmowy wstępnej.' : 'Podaj datę rozmowy rozpoczynającej.' });
  }
  return issues;
}

export function assessmentIssues(ev: Evaluation): Issue[] {
  const issues: Issue[] = [];
  for (const c of ev.criteriaAssessments) {
    const name = COMPETENCY_BY_CODE[c.competencyId].name;
    if (!c.indicatorAssessments.some((i) => i.selected)) {
      issues.push({ step: 'assessment', message: `${name}: dobierz co najmniej 1 wskaźnik.` });
    }
    if (c.finalScore === null) issues.push({ step: 'assessment', message: `${name}: wybierz ocenę cząstkową.` });
    else if (!isScoreAllowed(ev.formType, c.finalScore)) issues.push({ step: 'assessment', message: `${name}: ocena spoza skali arkusza.` });
  }
  return issues;
}

/** Full validation before `completeEvaluation` (shared by UI and the Cloud Function). */
export function completionIssues(ev: Evaluation, employee: Employee): Issue[] {
  const issues = [...initialTalkIssues(ev, employee), ...assessmentIssues(ev)];
  if (!ev.deadlines.finalTalkDate) issues.push({ step: 'final', message: 'Podaj datę rozmowy oceniającej.' });
  if (ev.type === 'FIRST_EVALUATION') {
    const r = ev.firstEvalRequirements;
    if (!r?.examPassed) issues.push({ step: 'final', message: 'Wskaż, czy oceniany zaliczył egzamin ze służby przygotowawczej.' });
    if (!r?.reportSubmittedOnTime) issues.push({ step: 'report', message: 'Wskaż, czy sprawozdanie złożono w terminie.' });
    if (!ev.departmentHeadApprovedAt) {
      issues.push({ step: 'complete', message: 'Pierwszą ocenę zatwierdza także kierujący komórką organizacyjną (arkusz podpisują oboje).' });
    }
  }
  const preview = previewResult(ev);
  if (preview?.finalResult === 'NEGATIVE' && !ev.texts.justification?.trim()) {
    issues.push({ step: 'final', message: 'Uzasadnienie jest obowiązkowe przy ocenie negatywnej.' });
  }
  if (ev.type === 'PERIODIC_EVALUATION' && !ev.texts.developmentPlan?.trim()) {
    issues.push({ step: 'final', message: 'Wnioski dotyczące indywidualnego programu rozwoju zawodowego są obowiązkowe.' });
  }
  if (ev.promotionRequest.included) {
    if (ev.type !== 'PERIODIC_EVALUATION' || employee.employmentType !== 'CIVIL_SERVANT') {
      issues.push({ step: 'final', message: 'Wniosek o kolejny stopień (Część III) dotyczy wyłącznie urzędnika służby cywilnej.' });
    } else if (preview?.finalResult !== 'POSITIVE') {
      issues.push({ step: 'final', message: 'Wniosek o kolejny stopień można dołączyć tylko do oceny pozytywnej.' });
    } else if (!ev.promotionRequest.requestedRank || !ev.promotionRequest.motivation?.trim()) {
      issues.push({ step: 'final', message: 'Uzupełnij wnioskowany stopień i umotywowanie wniosku (Część III).' });
    }
  }
  return issues;
}

// ----------------------------------------------------------------- results

/** Live preview of the result (null until every criterion has a final score / requirements are set). */
export function previewResult(ev: Evaluation): Omit<EvaluationSummary, 'computedAt'> | null {
  const scores = ev.criteriaAssessments.map((c) => c.finalScore);
  if (scores.some((s) => s === null)) return null;
  const s = scores as Score[];
  if (ev.type === 'FIRST_EVALUATION') {
    const r = ev.firstEvalRequirements;
    if (!r?.examPassed || !r.reportSubmittedOnTime) return null;
    const res = computeFirstResult(s, r.examPassed, r.reportSubmittedOnTime);
    return { averageScore: round2(res.averageScore), overallLevel: null, finalResult: res.finalResult };
  }
  const res = computePeriodicResult(s);
  return { averageScore: round2(res.averageScore), overallLevel: res.overallLevel, finalResult: res.finalResult };
}

const round2 = (x: number) => Math.round((x + Number.EPSILON) * 100) / 100;

/**
 * Server-side completion (Cloud Function `completeEvaluation`): validates, recomputes suggestions and the
 * result with the same domain functions as the UI, sets COMPLETED, periodTo and completedAt.
 */
export function completeEvaluation(ev: Evaluation, employee: Employee, onDate: DateOnly, now: Instant): Evaluation {
  if (isLocked(ev)) throw new Error('Ocena została już zatwierdzona.');
  const fresh = recalc(ev);
  const issues = completionIssues(fresh, employee);
  if (issues.length) throw new Error(issues.map((i) => i.message).join(' '));
  const result = previewResult(fresh)!;
  return {
    ...fresh,
    status: 'COMPLETED',
    currentStep: 'complete',
    summary: { ...result, computedAt: now },
    deadlines: {
      ...fresh.deadlines,
      periodFrom: fresh.deadlines.periodFrom ?? fresh.deadlines.initialTalkDate,
      periodTo: onDate,
    },
    completedAt: now,
    updatedAt: now,
  };
}

/** § 12 rozp. 2016 / § 11 rozp. 2015: the assessed person acknowledges; objection deadline only for periodic. */
export function acknowledge(ev: Evaluation, onDate: DateOnly, now: Instant): Evaluation {
  if (ev.status !== 'COMPLETED') throw new Error('Zapoznanie możliwe tylko po zatwierdzeniu oceny.');
  return {
    ...ev,
    status: 'ACKNOWLEDGED',
    deadlines: {
      ...ev.deadlines,
      acknowledgedAt: onDate,
      objectionDeadline: ev.type === 'PERIODIC_EVALUATION' ? objectionDeadline(onDate) : null,
    },
    updatedAt: now,
  };
}

/** HR projection — status and deadlines only, never scores or result (GDPR, schema § 4.1). */
export function toTracking(ev: Evaluation): EvaluationTracking {
  return {
    id: ev.id,
    officeId: ev.officeId,
    evaluationId: ev.id,
    type: ev.type,
    formType: ev.formType,
    status: ev.status,
    employeeName: ev.employeeName,
    department: ev.department,
    supervisorId: ev.supervisorId,
    supervisorName: ev.supervisorName,
    deadlines: {
      initialTalkDue: ev.deadlines.initialTalkDue,
      evaluationDueDate: ev.deadlines.evaluationDueDate,
      reportDueTo: ev.deadlines.reportDueTo,
      objectionDeadline: ev.deadlines.objectionDeadline,
    },
    updatedAt: ev.updatedAt,
  };
}

/** Part III (promotion request) applies only to a positive periodic evaluation of a civil servant. */
export const promotionApplicable = (ev: Evaluation, employee: Employee) =>
  ev.type === 'PERIODIC_EVALUATION' && employee.employmentType === 'CIVIL_SERVANT' && previewResult(ev)?.finalResult === 'POSITIVE';
