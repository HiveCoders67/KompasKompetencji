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

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && <p className="hint mt-1">{hint}</p>}
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
export function DeadlineBadge({ due, today, done, label }: { due: DateOnly | null; today: DateOnly; done: boolean; label?: string }) {
  if (!due) return <span className="hint">—</span>;
  const st = deadlineState(due, today, done);
  const cls = { OVERDUE: 'badge-error', SOON: 'badge-warning', OK: 'badge-outline', DONE: 'badge-success' }[st];
  const txt = { OVERDUE: 'po terminie', SOON: 'wkrótce', OK: '', DONE: 'zrobione' }[st];
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
