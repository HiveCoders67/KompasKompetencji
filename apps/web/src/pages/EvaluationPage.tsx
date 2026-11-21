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
import { Alert, Spinner, StatusBadge } from '../components/ui';
import { getEmployee, saveEvaluation, watchEvaluation } from '../data/repo';
import { StepAssessment } from './steps/StepAssessment';
import { StepComplete } from './steps/StepComplete';
import { StepFinal } from './steps/StepFinal';
import { StepOsp } from './steps/StepOsp';
import { StepReport } from './steps/StepReport';
import { StepStart } from './steps/StepStart';
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
    try {
      if (await saveEvaluation(saved.current, d)) {
        saved.current = d;
        setSavedAt(new Date());
      }
      setSaveError(null);
    } catch (e) {
      setSaveError((e as Error).message.includes('permission') ? 'Zapis odrzucony przez reguły bezpieczeństwa.' : (e as Error).message);
      throw e;
    }
  }, [readOnly]);

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
  const saveAndExit = async () => {
    try {
      await flush();
      nav('/oceny');
    } catch {
      /* error shown */
    }
  };

  return (
    <div className={assistantOpen ? 'pr-[420px]' : ''}>
      <header className="mb-s5 flex items-start justify-between gap-s4">
        <div>
          <p className="hint">
            {TYPE_LABELS[draft.type]} · {FORM_LABELS[draft.formType]}
          </p>
          <h2 className="h-dense">{draft.employeeName}</h2>
          <div className="mt-s2 flex items-center gap-s3">
            <StatusBadge status={draft.status} type={draft.type} />
            <span className="hint" aria-live="polite">
              {readOnly
                ? isLocked(draft)
                  ? 'Ocena zatwierdzona — tylko do odczytu'
                  : 'Podgląd (tylko do odczytu)'
                : savedAt
                  ? `Zapisano ${savedAt.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}`
                  : 'Autozapis włączony'}
            </span>
            {saveError && <span className="text-sm text-error">{saveError}</span>}
          </div>
        </div>
        <div className="flex shrink-0 gap-s2">
          <button className="btn btn-secondary" onClick={() => setAssistantOpen((o) => !o)} aria-expanded={assistantOpen}>
            {assistantOpen ? 'Ukryj asystenta' : 'Asystent AI'}
          </button>
          {isSupervisor && !readOnly && (
            <button className="btn btn-secondary" onClick={saveAndExit}>
              Zapisz wersję roboczą i wyjdź
            </button>
          )}
        </div>
      </header>

      <nav aria-label="Kroki oceny" className="mb-s6">
        <ol className="flex gap-1">
          {steps.map((s, i) => (
            <li key={s.id} className="flex-1">
              <button
                onClick={() => goTo(s.id)}
                aria-current={s.id === current ? 'step' : undefined}
                className={`w-full border-t-2 pt-s2 text-left text-sm transition-colors ${
                  s.id === current ? 'border-fg font-semibold' : i < idx ? 'border-line-strong text-fg' : 'border-line text-muted'
                }`}
              >
                <span className="mono mr-1">{i + 1}.</span>
                {s.label}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <Step {...props} />

      <AssistantPanel open={assistantOpen} onClose={() => setAssistantOpen(false)} ev={draft} step={current} update={update} readOnly={readOnly} />
    </div>
  );
}
