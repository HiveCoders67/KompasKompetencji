import { stepsFor, type Evaluation, type StepId } from '@kompas/domain';
import { Alert } from '../../components/ui';
import type { StepLock } from './progress';

/** A step that cannot be worked on yet: the reason plus a direct way to the step that unblocks it. */
export function LockedStep({ lock, goTo, ev }: { lock: StepLock; goTo: (s: StepId) => void; ev: Pick<Evaluation, 'type'> }) {
  const steps = stepsFor(ev);
  const n = steps.findIndex((s) => s.id === lock.goTo);
  return (
    <Alert tone="warning">
      <span className="flex items-center justify-between gap-s4">
        <span>{lock.reason}</span>
        <button className="btn btn-secondary btn-sm shrink-0" onClick={() => goTo(lock.goTo)}>
          Przejdź do kroku {n + 1}: {steps[n]?.label} →
        </button>
      </span>
    </Alert>
  );
}
