import { useState } from 'react';
import {
  LEVEL_LABELS,
  RESULT_LABELS,
  afterNegativeDeadlines,
  blockingIssues,
  completionIssues,
  formatAverage,
  formatPL,
  isLocked,
  stepsFor,
  today,
  type DateOnly,
} from '@kompas/domain';
import { useSession } from '../../app/session';
import { DateInput } from '../../components/DateInput';
import { Alert, BlockedReasons, Card, Field } from '../../components/ui';
import { acknowledgeEvaluation, approveFirstEvaluation, callableError, completeEvaluationFn } from '../../data/repo';
import { downloadEvaluationPdf } from '../../pdf/generate';
import { LockedStep } from './LockedStep';
import { stepLock } from './progress';
import type { StepProps } from './types';

export function StepComplete({ ev, employee, readOnly, isSupervisor, goTo, flush }: StepProps) {
  const { user } = useSession();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ackDate, setAckDate] = useState<DateOnly | null>(today());
  const isA = ev.type === 'FIRST_EVALUATION';
  const locked = isLocked(ev);
  const stepLocked = stepLock(ev, 'complete');
  // warnings (e.g. a late initial talk) are shown in step 1 and never block completion
  const issues = locked ? [] : blockingIssues(completionIssues(ev, employee, today()));
  const approvalIssue = issues.find((i) => i.step === 'complete');
  const blocking = issues.filter((i) => i.step !== 'complete');
  const steps = stepsFor(ev);
  const groups = steps
    .map((step, i) => ({ step, n: i + 1, items: blocking.filter((x) => x.step === step.id) }))
    .filter((g) => g.items.length > 0);
  const completeBlockers = [
    blocking.length > 0 && `Uzupełnij braki z listy powyżej (${blocking.length}).`,
    ev.status !== 'FINAL_TALK_DONE' && 'Najpierw potwierdź przeprowadzenie rozmowy oceniającej (krok 4).',
    !blocking.length && approvalIssue && 'Czeka na zatwierdzenie przez kierującego komórką.',
  ].filter(Boolean) as string[];
  const isHead = ev.departmentHeadId === user?.uid && isA;
  const s = ev.summary;

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(callableError(e));
    } finally {
      setBusy(null);
    }
  };

  const complete = () =>
    run('complete', async () => {
      await flush();
      await completeEvaluationFn({ evaluationId: ev.id });
    });
  const pdf = (draft: boolean) => run('pdf', () => downloadEvaluationPdf(ev, employee, { draft, part: 'ALL' }));

  if (stepLocked) return <LockedStep lock={stepLocked} goTo={goTo} ev={ev} />;

  return (
    <div className="flex flex-col gap-s5">
      {error && <Alert tone="error">{error}</Alert>}

      {!locked && (
        <Card title="Kontrola formalna przed zatwierdzeniem">
          {blocking.length === 0 ? (
            <Alert tone="success">Wszystkie wymagane pola są uzupełnione.</Alert>
          ) : (
            <div className="flex flex-col gap-s3">
              <p className="hint">Do uzupełnienia: {blocking.length}. Braki pogrupowane według kroków.</p>
              {groups.map((g) => (
                <section key={g.step.id} className="rounded-lg border border-line p-s4" aria-labelledby={`missing-${g.step.id}`}>
                  <div className="flex items-center justify-between gap-s3">
                    <p id={`missing-${g.step.id}`} className="font-semibold">
                      <span className="mono mr-1">{g.n}.</span>
                      {g.step.label}
                      <span className="hint ml-s2 font-normal">· {g.items.length}</span>
                    </p>
                    <button className="btn btn-secondary btn-sm" onClick={() => goTo(g.step.id)}>
                      Przejdź do kroku {g.n} →
                    </button>
                  </div>
                  <ul className="mt-s2 list-disc pl-5 text-sm">
                    {g.items.map((i) => (
                      <li key={i.message}>{i.message}</li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </Card>
      )}

      {isA && !locked && (
        <Card title="Zatwierdzenie przez kierującego komórką organizacyjną">
          {ev.departmentHeadApprovedAt ? (
            <Alert tone="success">Zatwierdzono {new Date(ev.departmentHeadApprovedAt).toLocaleString('pl-PL')}.</Alert>
          ) : isHead ? (
            <div className="flex flex-col gap-s3">
              <p>Arkusz pierwszej oceny podpisuje bezpośredni przełożony oraz kierujący komórką organizacyjną (Część VI).</p>
              <button
                className="btn self-start"
                disabled={ev.status !== 'FINAL_TALK_DONE' || busy === 'approve'}
                onClick={() => run('approve', () => approveFirstEvaluation(ev.id))}
              >
                Zatwierdzam pierwszą ocenę
              </button>
              {ev.status !== 'FINAL_TALK_DONE' && <p className="hint">Zatwierdzenie możliwe po rozmowie oceniającej.</p>}
            </div>
          ) : (
            <Alert tone="warning">{approvalIssue?.message ?? 'Oczekuje na zatwierdzenie przez kierującego komórką.'} Kierujący zatwierdza ocenę w swoim widoku „Zatwierdzenia”.</Alert>
          )}
        </Card>
      )}

      {locked && s && (
        <Card title={isA ? 'Pierwsza ocena — sporządzona' : 'Ocena okresowa — sporządzona'}>
          <div className="flex flex-wrap items-center gap-s6">
            <div>
              <p className="hint">{isA ? 'Ocena łączna' : 'Średnia'}</p>
              <p className="text-[26px] font-semibold tabular-nums">{formatAverage(s.averageScore)}</p>
            </div>
            {s.overallLevel && (
              <div>
                <p className="hint">Poziom</p>
                <p className="font-semibold">{LEVEL_LABELS[s.overallLevel]}</p>
              </div>
            )}
            <div>
              <p className="hint">Wynik</p>
              <span className={`badge ${s.finalResult === 'NEGATIVE' ? 'badge-error' : 'badge-success'}`}>{RESULT_LABELS[s.finalResult]}</span>
            </div>
            <div>
              <p className="hint">Wyliczono na serwerze</p>
              <p className="text-sm">{new Date(s.computedAt).toLocaleString('pl-PL')}</p>
            </div>
          </div>
        </Card>
      )}

      {ev.status === 'COMPLETED' && isSupervisor && (
        <Card title="Zapoznanie ocenianego z oceną">
          <p className="hint mb-s3">
            {isA ? '§ 11 rozp. z 2015 r.' : '§ 12 rozp. z 2016 r. — od dnia zapoznania biegnie 7-dniowy termin na sprzeciw (art. 83 ust. 1 ustawy).'}
          </p>
          <div className="flex items-end gap-s3">
            <Field label="Data zapoznania się z oceną" required>
              <DateInput value={ackDate} onChange={setAckDate} min={ev.deadlines.periodTo} />
            </Field>
            <button className="btn" disabled={!ackDate || busy === 'ack'} onClick={() => ackDate && run('ack', () => acknowledgeEvaluation(ev, ackDate))}>
              Oceniany zapoznał się z oceną
            </button>
          </div>
        </Card>
      )}

      {ev.status === 'ACKNOWLEDGED' && (
        <Card title="Po zapoznaniu">
          <div className="flex flex-col gap-s3">
            <p>
              Zapoznanie: <span className="mono">{formatPL(ev.deadlines.acknowledgedAt)}</span>
            </p>
            {ev.deadlines.objectionDeadline && (
              <Alert>
                Sprzeciw do dyrektora generalnego urzędu przysługuje do <strong className="mono">{formatPL(ev.deadlines.objectionDeadline)}</strong> (art. 83 ust. 1 ustawy).
              </Alert>
            )}
            {!isA && s?.finalResult === 'NEGATIVE' && ev.deadlines.periodTo && ev.deadlines.acknowledgedAt && (
              <Alert tone="warning" title="Ponowna ocena po ocenie negatywnej (art. 81 ust. 3 ustawy)">
                Termin ponownej oceny: {formatPL(afterNegativeDeadlines(ev.deadlines.periodTo, ev.deadlines.acknowledgedAt).evaluationDueDate)} (po upływie 6
                miesięcy od zapoznania). Termin nie przedłuża się o nieobecność i nie podlega zmianie z art. 81 ust. 8.
              </Alert>
            )}
          </div>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <div className="flex gap-s2">
          {locked ? (
            <button className="btn btn-secondary" onClick={() => pdf(false)} disabled={busy === 'pdf'}>
              Pobierz arkusz PDF
            </button>
          ) : (
            <button className="btn btn-secondary" onClick={() => pdf(true)} disabled={busy === 'pdf'}>
              PDF — projekt arkusza
            </button>
          )}
        </div>
        {!locked && isSupervisor && (
          <button
            className="btn"
            onClick={complete}
            disabled={readOnly || issues.length > 0 || ev.status !== 'FINAL_TALK_DONE' || busy === 'complete'}
            aria-describedby={completeBlockers.length ? 'complete-blockers' : undefined}
          >
            {busy === 'complete' ? 'Zatwierdzanie…' : 'Zatwierdź ocenę'}
          </button>
        )}
      </div>
      {!locked && isSupervisor && !readOnly && <BlockedReasons id="complete-blockers" reasons={completeBlockers} />}
    </div>
  );
}
