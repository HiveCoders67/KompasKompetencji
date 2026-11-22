import { useState } from 'react';
import { extendReportDeadline, formatPL, isWithin, reportCoversMinimumPeriod, statusRank, today, type DateOnly } from '@kompas/domain';
import { Alert, BlockedReasons, Card, DeadlineBadge, Field } from '../../components/ui';
import { DateInput } from '../../components/DateInput';
import { LockedStep } from './LockedStep';
import { stepLock } from './progress';
import type { StepProps } from './types';

/** Path A — the report (§ 4–6 rozp. z 2015 r.). Only dates are stored, never the report's content (GDPR). */
export function StepReport({ ev, employee, update, readOnly, next, goTo }: StepProps) {
  const d = ev.deadlines;
  const done = statusRank(ev) >= 2;
  const [absFrom, setAbsFrom] = useState<DateOnly | null>(null);
  const [absTo, setAbsTo] = useState<DateOnly | null>(null);

  const lock = stepLock(ev, 'report');
  if (lock) return <LockedStep lock={lock} goTo={goTo} ev={ev} />;

  const submitted = d.reportSubmittedAt;
  const onTime = submitted && d.reportDueFrom && d.reportDueTo ? isWithin(submitted, d.reportDueFrom, d.reportDueTo) : null;
  const tooEarly = submitted ? !reportCoversMinimumPeriod(employee.hireDate, submitted) : false;
  const deadlinePassed = !!d.reportDueTo && today() > d.reportDueTo;

  const setSubmitted = (v: DateOnly | null) =>
    update((e) => {
      const ok = v && e.deadlines.reportDueFrom && e.deadlines.reportDueTo ? isWithin(v, e.deadlines.reportDueFrom, e.deadlines.reportDueTo) : null;
      return {
        ...e,
        deadlines: { ...e.deadlines, reportSubmittedAt: v },
        firstEvalRequirements: { examPassed: e.firstEvalRequirements?.examPassed ?? null, reportSubmittedOnTime: v ? (ok ? 'YES' : 'NO') : null },
      };
    });

  const extend = () => {
    if (!absFrom || !absTo || !d.reportDueTo || !d.evaluationWindowTo) return;
    const to = extendReportDeadline(d.reportDueTo, { from: absFrom, to: absTo }, d.evaluationWindowTo);
    update((e) => ({ ...e, deadlines: { ...e.deadlines, reportDueTo: to } }));
    setAbsFrom(null);
    setAbsTo(null);
  };

  const confirm = (notSubmitted: boolean) =>
    update((e) => ({
      ...e,
      status: 'REPORT_SUBMITTED',
      currentStep: 'assessment',
      firstEvalRequirements: {
        examPassed: e.firstEvalRequirements?.examPassed ?? null,
        reportSubmittedOnTime: notSubmitted ? 'NO' : e.firstEvalRequirements?.reportSubmittedOnTime ?? null,
      },
      deadlines: notSubmitted ? { ...e.deadlines, reportSubmittedAt: null } : e.deadlines,
    }));

  return (
    <div className="flex flex-col gap-s5">
      <Card title="Sprawozdanie z wykonywania zadań">
        <div className="grid grid-cols-2 gap-s5">
          <div>
            <p className="label">Termin złożenia</p>
            <p className="mono">
              {formatPL(d.reportDueFrom)} – {formatPL(d.reportDueTo)}
            </p>
            <div className="mt-1">
              <DeadlineBadge due={d.reportDueTo} today={today()} done={!!submitted} />
            </div>
          </div>
          <Field label="Data złożenia sprawozdania" htmlFor="reportSubmittedAt" required={!done && !deadlinePassed} hint="Treści sprawozdania nie przechowujemy — tylko datę i informację o terminowości.">
            <DateInput id="reportSubmittedAt" value={submitted} onChange={setSubmitted} disabled={readOnly || done} />
          </Field>
        </div>
        {submitted && (
          <div className="mt-s4 flex flex-col gap-s2">
            {onTime ? (
              <Alert tone="success">Sprawozdanie złożone w wyznaczonym terminie.</Alert>
            ) : (
              <Alert tone="warning" title="Sprawozdanie po terminie">
                Złożenie sprawozdania w wyznaczonym terminie jest warunkiem pozytywnej pierwszej oceny (§ 10 ust. 1 pkt 2 rozp. z 2015 r.).
              </Alert>
            )}
            {tooEarly && <Alert tone="warning">Sprawozdanie powinno obejmować co najmniej 7 miesięcy pracy od nawiązania stosunku pracy ({formatPL(employee.hireDate)}).</Alert>}
          </div>
        )}
      </Card>

      {!done && !readOnly && (
        <Card title="Usprawiedliwiona nieobecność w okresie sprawozdawczym (§ 5 rozp. z 2015 r.)">
          <p className="hint mb-s3">Termin złożenia sprawozdania przedłuża się o czas nieobecności, nie dłużej niż do końca okresu dokonania oceny.</p>
          <div className="flex items-end gap-s3">
            <Field label="Nieobecność od">
              <DateInput value={absFrom} onChange={setAbsFrom} />
            </Field>
            <Field label="do">
              <DateInput value={absTo} onChange={setAbsTo} min={absFrom} />
            </Field>
            <button className="btn btn-secondary" disabled={!absFrom || !absTo} onClick={extend}>
              Przedłuż termin
            </button>
          </div>
        </Card>
      )}

      <div className="flex justify-end gap-s2">
        {done ? (
          <button className="btn" onClick={next}>
            Dalej
          </button>
        ) : (
          <>
            {deadlinePassed && !submitted && (
              <button className="btn btn-secondary" onClick={() => confirm(true)} disabled={readOnly}>
                Termin upłynął — sprawozdania nie złożono
              </button>
            )}
            <button className="btn" onClick={() => confirm(false)} disabled={readOnly || !submitted} aria-describedby={!submitted ? 'report-blockers' : undefined}>
              Potwierdź złożenie sprawozdania
            </button>
          </>
        )}
      </div>
      {!done && !readOnly && <BlockedReasons id="report-blockers" reasons={submitted ? [] : ['Podaj datę złożenia sprawozdania.']} />}
    </div>
  );
}
