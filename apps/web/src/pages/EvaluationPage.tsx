import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  FORM_LABELS,
  TYPE_LABELS,
  autoStatus,
  isLocked,
  recalc,
  stepsFor,
  type Employee,
  type Evaluation,
  type StepId,
} from '@kompas/domain';
import { useSession } from '../app/session';
import { AssistantPanel } from '../components/AssistantPanel';
import { Alert, Hint, Spinner, StatusBadge } from '../components/ui';
import { getEmployee, saveEvaluation, watchEvaluation } from '../data/repo';
import { StepAssessment } from './steps/StepAssessment';
import { StepComplete } from './steps/StepComplete';
import { StepFinal } from './steps/StepFinal';
import { StepOsp } from './steps/StepOsp';
import { StepReport } from './steps/StepReport';
import { StepStart } from './steps/StepStart';
import { stepProgress, type StepState } from './steps/progress';
import type { StepProps } from './steps/types';

const AUTOSAVE_MS = 2000;
const SERVER_FIELDS = ['summary', 'completedAt', 'departmentHeadApprovedAt', 'updatedAt'] as const;
const editable = (e: Evaluation) => {
  const copy: Partial<Evaluation> = { ...e };
  for (const k of SERVER_FIELDS) delete copy[k];
  return JSON.stringify(copy);
};

const STEP_COMPONENTS: Record<StepId, (p: StepProps) => React.JSX.Element> = {
  osp: StepOsp,
  start: StepStart,
  report: StepReport,
  assessment: StepAssessment,
  final: StepFinal,
  complete: StepComplete,
};

export function EvaluationPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useSession();
  const nav = useNavigate();
  const [draft, setDraft] = useState<Evaluation | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const saved = useRef<Evaluation | null>(null);
  const draftRef = useRef<Evaluation | null>(null);
  draftRef.current = draft;

  const isSupervisor = !!draft && draft.supervisorId === user?.uid;
  const readOnly = !draft || !isSupervisor || isLocked(draft);

  // live document; local edits win until saved, server-only fields always come from the server
  useEffect(() => {
    if (!id) return;
    return watchEvaluation(
      id,
      (server) => {
        if (!server) {
          setError('Nie znaleziono oceny.');
          return;
        }
        const local = draftRef.current;
        const dirty = local && saved.current && editable(local) !== editable(saved.current);
        saved.current = server;
        if (!local || !dirty || isLocked(server)) setDraft(server);
        else setDraft({ ...local, summary: server.summary, completedAt: server.completedAt, departmentHeadApprovedAt: server.departmentHeadApprovedAt, updatedAt: server.updatedAt });
      },
      (e) => setError(e.message.includes('permission') ? 'Brak dostępu do tej oceny.' : e.message),
    );
  }, [id]);

  useEffect(() => {
    if (draft && !employee) getEmployee(draft.employeeId).then(setEmployee).catch((e) => setError((e as Error).message));
  }, [draft?.employeeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const flush = useCallback(async () => {
    const d = draftRef.current;
    if (!d || !saved.current || readOnly) return;
    setSaving(true);
    try {
      if (await saveEvaluation(saved.current, d)) {
        saved.current = d;
        setSavedAt(new Date());
      }
      setSaveError(null);
    } catch (e) {
      setSaveError((e as Error).message.includes('permission') ? 'Zapis odrzucony przez reguły bezpieczeństwa.' : (e as Error).message);
      throw e;
    } finally {
      setSaving(false);
    }
  }, [readOnly]);

  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => () => void flushRef.current().catch(() => undefined), []);

  const dirty = !!draft && !!saved.current && !readOnly && editable(draft) !== editable(saved.current);

  // closing the tab with unsaved edits (autosave waits AUTOSAVE_MS) → the browser asks first
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // debounced autosave
  useEffect(() => {
    if (!draft || readOnly || !saved.current || editable(draft) === editable(saved.current)) return;
    const t = setTimeout(() => flush().catch(() => undefined), AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [draft, readOnly, flush]);

  const update = useCallback(
    (fn: (ev: Evaluation) => Evaluation) => {
      if (readOnly) return;
      setDraft((d) => (d ? autoStatus(recalc(fn(d))) : d));
    },
    [readOnly],
  );

  if (error) return <Alert tone="error" title={error}><Link to="/" className="underline">Wróć</Link></Alert>;
  if (!draft || !employee) return <Spinner />;

  const steps = stepsFor(draft);
  const progress = stepProgress(draft, employee);
  const current = (steps.find((s) => s.id === draft.currentStep) ?? steps[0]).id;
  const idx = steps.findIndex((s) => s.id === current);
  const goTo = (step: StepId) => {
    if (readOnly) setDraft({ ...draft, currentStep: step });
    else update((e) => ({ ...e, currentStep: step }));
    window.scrollTo({ top: 0 });
  };
  const Step = STEP_COMPONENTS[current];
  const props: StepProps = {
    ev: draft,
    employee,
    update,
    setEmployee,
    readOnly,
    isSupervisor,
    goTo,
    next: () => idx < steps.length - 1 && goTo(steps[idx + 1].id),
    flush,
  };
  // autosave keeps the draft up to date; leaving still waits for the pending write, and stays put if it fails
  const back = isSupervisor ? { to: '/oceny', label: 'Moje oceny' } : { to: '/zatwierdzenia', label: 'Zatwierdzenia' };
  const leave = async (e: React.MouseEvent) => {
    if (readOnly) return;
    e.preventDefault();
    try {
      await flush();
      nav(back.to);
    } catch {
      /* error shown in SaveStatus */
    }
  };

  return (
    <div className="pb-[88px]" data-no-reveal>
      <header className="mb-s5 flex items-start justify-between gap-s4">
        <div>
          <Link to={back.to} onClick={leave} className="back-link mb-s2">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10 3.5L5.5 8l4.5 4.5" />
            </svg>
            {back.label}
          </Link>
          <p className="hint">
            {TYPE_LABELS[draft.type]} · {FORM_LABELS[draft.formType]}
          </p>
          <h2 className="h-dense">{draft.employeeName}</h2>
          <div className="mt-s2 flex items-center gap-s3">
            <StatusBadge status={draft.status} type={draft.type} />
            {readOnly ? (
              <span className="hint">{isLocked(draft) ? 'Ocena zatwierdzona — tylko do odczytu' : 'Podgląd (tylko do odczytu)'}</span>
            ) : (
              <SaveStatus
                state={saveError ? 'error' : saving || dirty ? 'saving' : 'saved'}
                savedAt={savedAt}
                error={saveError}
                retry={() => flush().catch(() => undefined)}
              />
            )}
          </div>
        </div>
      </header>

      <nav aria-label="Kroki oceny" className="mb-s6">
        <ol className="flex gap-1">
          {progress.map((s, i) => {
            // a locked step cannot be entered from the stepper; the tooltip says what unlocks it
            const locked = s.state === 'locked' && s.id !== current;
            const tab = (
              <button
                onClick={() => !locked && goTo(s.id)}
                aria-current={s.id === current ? 'step' : undefined}
                aria-disabled={locked || undefined}
                aria-describedby={locked ? `step-lock-${s.id}` : undefined}
                className={`step-tab w-full border-t-2 pt-s2 text-left text-sm ${
                  s.id === current ? 'border-accent font-semibold' : s.state === 'done' ? 'border-success text-fg' : i < idx ? 'border-line-strong text-fg' : 'border-line text-muted'
                }`}
              >
                <span className="flex items-center gap-1">
                  <span className="mono">{i + 1}.</span>
                  {s.label}
                  <StepIcon state={s.state} />
                </span>
                {s.note && (
                  <span className={`block text-xs font-normal ${s.state === 'done' ? 'text-success' : 'text-muted'}`}>{s.note}</span>
                )}
                {locked && (
                  <span id={`step-lock-${s.id}`} className="sr-only">
                    {s.lock?.reason}
                  </span>
                )}
              </button>
            );
            return (
              <li key={s.id} className="flex-1">
                {locked && s.lock ? <Hint text={s.lock.reason}>{tab}</Hint> : tab}
              </li>
            );
          })}
        </ol>
      </nav>

      <Step {...props} />

      <AssistantPanel open={assistantOpen} onOpenChange={setAssistantOpen} ev={draft} step={current} update={update} readOnly={readOnly} />
    </div>
  );
}

function StepIcon({ state }: { state: StepState }) {
  if (state === 'todo') return null;
  return (
    <svg className={`shrink-0 ${state === 'done' ? 'text-success' : 'text-muted'}`} width="14" height="14" viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {state === 'done' ? <path d="M3.5 8.5l3 3 6-7" /> : <><rect x="3.5" y="7" width="9" height="6.5" rx="1.5" /><path d="M5.5 7V5a2.5 2.5 0 015 0v2" /></>}
    </svg>
  );
}

/** Autosave state next to the status badge: saving → saved at HH:MM, or the error with a retry. */
function SaveStatus({ state, savedAt, error, retry }: { state: 'saving' | 'saved' | 'error'; savedAt: Date | null; error: string | null; retry: () => void }) {
  const time = savedAt?.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  return (
    <span className="flex items-center gap-s2 text-sm" role="status" aria-live="polite">
      <span className={`save-dot ${state}`} aria-hidden="true" />
      {state === 'error' ? (
        <>
          <span className="text-error">Nie zapisano zmian: {error}</span>
          <button className="btn btn-ghost btn-sm" onClick={retry}>
            Spróbuj ponownie
          </button>
        </>
      ) : (
        <span className="text-muted">{state === 'saving' ? 'Zapisywanie…' : time ? `Zapisano ${time}` : 'Wszystkie zmiany zapisane'}</span>
      )}
    </span>
  );
}
