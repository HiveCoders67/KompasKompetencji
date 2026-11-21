import type { Employee, Evaluation, StepId } from '@kompas/domain';

export interface StepProps {
  ev: Evaluation;
  employee: Employee;
  /** Applies a change to the draft (autosaved). */
  update: (fn: (ev: Evaluation) => Evaluation) => void;
  setEmployee: (e: Employee) => void;
  /** Supervisor cannot edit (locked) or the viewer is the department head. */
  readOnly: boolean;
  isSupervisor: boolean;
  goTo: (step: StepId) => void;
  next: () => void;
  /** Persists pending changes immediately (before actions that read the stored document). */
  flush: () => Promise<void>;
}
