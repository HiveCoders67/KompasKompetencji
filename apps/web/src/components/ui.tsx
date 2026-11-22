import * as Dialog from '@radix-ui/react-dialog';
import * as Tooltip from '@radix-ui/react-tooltip';
import { deadlineState, formatPL, statusLabel, type DateOnly, type EvaluationStatus, type EvaluationType } from '@kompas/domain';
import type { ReactNode } from 'react';

export function PageHeader({ title, lead, actions }: { title: string; lead?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-s6 flex items-end justify-between gap-s5">
      <div>
        <h2 className="h-dense">{title}</h2>
        {lead && <p className="hint mt-s2 max-w-[760px] text-base">{lead}</p>}
      </div>
      {actions && <div className="flex shrink-0 gap-s2">{actions}</div>}
    </header>
  );
}

export function Card({ title, children, className = '', actions }: { title?: ReactNode; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <div className="mb-s4 flex items-start justify-between gap-s4">
          {title && <h5>{title}</h5>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

type Tone = 'info' | 'success' | 'warning' | 'error';
export function Alert({ tone = 'info', title, children }: { tone?: Tone; title?: string; children?: ReactNode }) {
  return (
    <div className={`alert ${tone === 'info' ? '' : `alert-${tone}`}`} role={tone === 'error' || tone === 'warning' ? 'alert' : 'status'}>
      <div>
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? 'mt-1' : ''}>{children}</div>}
      </div>
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
  htmlFor,
  issues,
  issuesId,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  htmlFor?: string;
  /** Validation messages shown in a popup attached to this field. */
  issues?: { message: string; severity?: 'warning' }[];
  /** id of the popup (referenced by the inputs' aria-describedby). */
  issuesId?: string;
}) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {issues && issues.length > 0 && <FieldPopup id={issuesId} issues={issues} />}
      {hint && <p className="hint mt-1">{hint}</p>}
    </div>
  );
}

/** Popup bubble attached to a form field (arrow pointing at the input); red if any message blocks, otherwise amber. */
export function FieldPopup({ id, issues }: { id?: string; issues: { message: string; severity?: 'warning' }[] }) {
  const tone = issues.some((i) => i.severity !== 'warning') ? 'error' : 'warning';
  return (
    <div id={id} className={`field-popup field-popup-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {issues.length === 1 ? (
        <p>{issues[0].message}</p>
      ) : (
        <ul className="list-disc pl-4">
          {issues.map((i) => (
            <li key={i.message}>{i.message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

const STATUS_TONE: Record<EvaluationStatus, string> = {
  DRAFT: 'badge-outline',
  INITIAL_TALK_DONE: 'badge-info',
  REPORT_SUBMITTED: 'badge-info',
  IN_PROGRESS: 'badge-info',
  FINAL_TALK_DONE: 'badge-info',
  COMPLETED: 'badge-success',
  ACKNOWLEDGED: 'badge-success',
};
export const StatusBadge = ({ status, type }: { status: EvaluationStatus; type: EvaluationType }) => (
  <span className={`badge ${STATUS_TONE[status]}`}>{statusLabel(status, type)}</span>
);

/** Deadline with a consistent status mapping (overdue → error, ≤ 14 days → warning). */
/**
 * `doneOn` (date the action took place) refines `done`: a future date → „zaplanowane”, a date after `due` → „zrobione po terminie”.
 */
export function DeadlineBadge({ due, today, done, doneOn, label }: { due: DateOnly | null; today: DateOnly; done: boolean; doneOn?: DateOnly | null; label?: string }) {
  if (!due) return <span className="hint">—</span>;
  const planned = !!doneOn && doneOn > today;
  const st = deadlineState(due, today, done && !planned);
  const late = st === 'DONE' && !!doneOn && doneOn > due;
  const cls = late ? 'badge-warning' : { OVERDUE: 'badge-error', SOON: 'badge-warning', OK: 'badge-outline', DONE: 'badge-success' }[st];
  const txt = late ? 'zrobione po terminie' : { OVERDUE: 'po terminie', SOON: 'wkrótce', OK: '', DONE: 'zrobione' }[st];
  if (planned) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="mono text-sm">{formatPL(due)}</span>
        <span className={`badge ${doneOn! > due ? 'badge-error' : 'badge-outline'}`}>zaplanowane{doneOn! > due ? ' po terminie' : ''}</span>
        {label && <span className="hint">{label}</span>}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2">
      <span className="mono text-sm">{formatPL(due)}</span>
      {st !== 'OK' && <span className={`badge ${cls}`}>{txt}</span>}
      {label && <span className="hint">{label}</span>}
    </span>
  );
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-[color-mix(in_srgb,var(--sf-text-primary)_30%,transparent)]" />
        <Dialog.Content className="modal fixed left-1/2 top-1/2 w-[560px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2">
          <Dialog.Title asChild>
            <h5>{title}</h5>
          </Dialog.Title>
          {description ? <Dialog.Description className="hint mt-s2">{description}</Dialog.Description> : <Dialog.Description className="sr-only">{title}</Dialog.Description>}
          <div className="mt-s4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function Hint({ text, children }: { text: string; children: ReactNode }) {
  return (
    <Tooltip.Root delayDuration={200}>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="tooltip" sideOffset={6}>
          {text}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export const Spinner = ({ label = 'Wczytywanie…' }: { label?: string }) => (
  <p className="hint" role="status" aria-live="polite">
    {label}
  </p>
);

export function Empty({ children }: { children: ReactNode }) {
  return <p className="hint rounded-lg border border-dashed border-line-strong p-s5 text-center">{children}</p>;
}
