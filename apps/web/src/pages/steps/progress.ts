import { blockingIssues, completionIssues, isLocked, statusRank, stepsFor, today, type Employee, type Evaluation, type Issue, type StepId } from '@kompas/domain';

/*
 * Per-step progress for the stepper and the completion checklist. Built from the same validation as
 * `completeEvaluation` (completionIssues), so the stepper never disagrees with what blocks completion.
 */

export type StepState = 'done' | 'todo' | 'locked';

export interface StepProgress {
  id: StepId;
  label: string;
  state: StepState;
  /** Blocking issues that belong to this step. */
  issues: Issue[];
  /** Short status line under the step label (null = nothing to say). */
  note: string | null;
  /** Set when the step cannot be entered yet. */
  lock?: StepLock;
}

export interface StepLock {
  reason: string;
  /** Step where the user can unblock it. */
  goTo: StepId;
}

/** Why a step cannot be worked on yet (null = open). `goTo` always points to a step that can be entered. */
export function stepLock(ev: Evaluation, step: StepId): StepLock | null {
  const lock = directLock(ev, step);
  if (!lock) return null;
  // follow the chain (e.g. 5 → 4 → 3) so „Przejdź do kroku…” never lands on another locked step
  let target = lock.goTo;
  for (let guard = 0; guard < 6; guard++) {
    const next = directLock(ev, target);
    if (!next) break;
    target = next.goTo;
  }
  return { ...lock, goTo: target };
}

function directLock(ev: Evaluation, step: StepId): StepLock | null {
  const isA = ev.type === 'FIRST_EVALUATION';
  if (ev.status === 'DRAFT' && (step === 'report' || step === 'assessment')) {
    return {
      reason: isA ? 'Najpierw potwierdź przeprowadzenie rozmowy wstępnej.' : 'Najpierw potwierdź przeprowadzenie rozmowy rozpoczynającej.',
      goTo: 'start',
    };
  }
  if (step === 'assessment' && isA && ev.status === 'INITIAL_TALK_DONE') {
    return { reason: 'Ocenę elementów rozpoczyna się po złożeniu sprawozdania (lub upływie terminu).', goTo: 'report' };
  }
  // the final talk discusses the partial scores (§ 10 rozp. 2016, § 8 rozp. 2015) — they must all be chosen first
  if (step === 'final' && !isLocked(ev) && statusRank(ev) < 3) {
    const missing = unfinishedCriteria(ev).length;
    const label = stepsFor(ev).find((s) => s.id === 'assessment')?.label;
    if (missing) return { reason: `Najpierw oceń wszystkie kryteria w kroku „${label}” — pozostało: ${missing}.`, goTo: 'assessment' };
  }
  // the evaluation is drawn up after the final talk (docs/02 § 4: FINAL_TALK_DONE → COMPLETED) — so is the department head's approval
  if (step === 'complete' && !isLocked(ev) && statusRank(ev) < 3) {
    const n = stepsFor(ev).findIndex((s) => s.id === 'final') + 1;
    return { reason: `Najpierw potwierdź przeprowadzenie rozmowy oceniającej (krok ${n}).`, goTo: 'final' };
  }
  return null;
}

/** Codes of criteria with a blocking issue in the assessment step (no indicator selected or no partial score). */
export function unfinishedCriteria(ev: Evaluation): string[] {
  return ev.criteriaAssessments
    .filter((c) => c.finalScore === null || !c.indicatorAssessments.some((i) => i.selected))
    .map((c) => c.competencyId);
}

/** Steps whose work ends with an explicit confirmation (status change), not just with filled-in fields. */
const CONFIRMED_AT: Partial<Record<StepId, number>> = { start: 1, report: 2, final: 3 };

export function stepProgress(ev: Evaluation, employee: Employee): StepProgress[] {
  const locked = isLocked(ev);
  const issues = locked ? [] : blockingIssues(completionIssues(ev, employee, today()));
  const rank = statusRank(ev);

  return stepsFor(ev).map(({ id, label }) => {
    const own = issues.filter((i) => i.step === id);
    if (locked) return { id, label, state: 'done', issues: own, note: 'gotowe' };

    const lock = stepLock(ev, id);
    if (lock) return { id, label, state: 'locked', issues: own, note: 'zablokowany', lock };

    const confirmAt = CONFIRMED_AT[id];
    const done = id === 'complete' ? false : confirmAt !== undefined ? rank >= confirmAt : own.length === 0;
    if (done) return { id, label, state: 'done', issues: own, note: 'gotowe' };

    let note: string | null = null;
    if (id === 'assessment') {
      const scored = ev.criteriaAssessments.filter((c) => c.finalScore !== null).length;
      note = `ocenione ${scored} z ${ev.criteriaAssessments.length}`;
    } else if (id === 'complete') {
      // the only issue of this step is the department head's approval (path A); it matters once the final talk is done
      if (ev.status === 'FINAL_TALK_DONE') note = own.length ? 'czeka na kierującego komórką' : 'do zatwierdzenia';
    } else if (own.length) note = `do uzupełnienia: ${own.length}`;
    else if (confirmAt !== undefined) note = 'do potwierdzenia';
    return { id, label, state: 'todo', issues: own, note };
  });
}
