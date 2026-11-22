import { useState } from 'react';
import {
  COMPETENCY_BY_CODE,
  FORM_SHORT,
  formatPL,
  blockingIssues,
  firstEvaluationDeadlines,
  initialTalkIssues,
  isBlocking,
  statusRank,
  today,
  type DeadlineField,
} from '@kompas/domain';
import { Alert, Card, DeadlineBadge, Field } from '../../components/ui';
import { DateInput, DateRangeInput } from '../../components/DateInput';
import { downloadEvaluationPdf } from '../../pdf/generate';
import type { StepProps } from './types';

export function StepStart({ ev, employee, update, readOnly, next }: StepProps) {
  const isA = ev.type === 'FIRST_EVALUATION';
  const d = ev.deadlines;
  const done = statusRank(ev) >= 1;
  const now = today();
  const issues = initialTalkIssues(ev, employee, now);
  const blocking = blockingIssues(issues);
  const [pdfBusy, setPdfBusy] = useState(false);
  // „missing value” messages wait until the field is touched or the user tries to confirm; value errors show at once
  const [touched, setTouched] = useState<Set<DeadlineField>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const touch = (f: DeadlineField) => setTouched((t) => (t.has(f) ? t : new Set(t).add(f)));
  const visible = (f: DeadlineField) => (done ? [] : issues.filter((i) => i.field === f && (!i.missing || submitted || touched.has(f))));
  const tone = (f: DeadlineField) => {
    const v = visible(f);
    return v.length === 0 ? false : v.some(isBlocking) ? 'error' : 'warning';
  };
  const popupId = (f: DeadlineField) => (visible(f).length ? `issues-${f}` : undefined);
  const otherIssues = issues.filter((i) => !i.field); // e.g. path B: form choice / criteria — no date field to attach to
  // picker hints from the law (validation still reports typed values outside them)
  const legal = isA ? firstEvaluationDeadlines(employee.hireDate) : null;
  const notBeforeTalk = (bound: string | undefined) => (d.initialTalkDate && bound && d.initialTalkDate > bound ? d.initialTalkDate : bound);

  const setDeadlines = (patch: Partial<typeof d>) => update((e) => ({ ...e, deadlines: { ...e.deadlines, ...patch } }));
  const setDeadline = (key: keyof typeof d, value: string | null) => setDeadlines({ [key]: value });

  const tryConfirm = () => {
    if (blocking.length > 0) {
      setSubmitted(true);
      const first = blocking.find((i) => i.field)?.field;
      if (first) document.getElementById(`field-${first}`)?.focus();
      return;
    }
    confirm();
  };

  const confirm = () =>
    update((e) => ({
      ...e,
      status: 'INITIAL_TALK_DONE',
      deadlines: { ...e.deadlines, periodFrom: e.type === 'PERIODIC_EVALUATION' ? e.deadlines.initialTalkDate : e.deadlines.periodFrom },
      currentStep: e.type === 'FIRST_EVALUATION' ? 'report' : 'assessment',
    }));

  const pdf = async () => {
    setPdfBusy(true);
    try {
      await downloadEvaluationPdf(ev, employee, { draft: true, part: 'START' });
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-s5">
      <Alert title={isA ? 'Rozmowa wstępna (§ 3 rozp. z 2015 r.)' : 'Rozmowa rozpoczynająca (§ 5 ust. 1 rozp. z 2016 r.)'}>
        {isA
          ? 'W terminie 21 dni od nawiązania stosunku pracy omów z ocenianym sposób wykonywania obowiązków, elementy oceny i oczekiwane zachowania; wyznacz termin sprawozdania i okres dokonania oceny.'
          : 'Omów z ocenianym główne obowiązki z OSP, kryteria oceny i oczekiwania co do sposobu ich spełniania oraz termin sporządzenia oceny. Wskaźniki poniżej to tematy rozmowy — na tym etapie niczego nie zaznaczasz.'}
      </Alert>

      <Card title={isA ? 'Elementy oceny — tematy rozmowy o oczekiwaniach' : `Kryteria (${FORM_SHORT[ev.formType]}) — tematy rozmowy o oczekiwaniach`}>
        <div className="grid grid-cols-2 gap-s4">
          {ev.criteriaAssessments.map((c) => {
            const comp = COMPETENCY_BY_CODE[c.competencyId];
            return (
              <div key={c.competencyId} className="rounded-lg border border-line p-s3">
                <p className="font-semibold">
                  {comp.name} {!c.isMandatory && <span className="badge badge-outline ml-1">dodatkowe</span>}
                </p>
                <ul className="mt-2 list-disc pl-5 text-sm text-muted">
                  {comp.indicators.map((i) => (
                    <li key={i.id}>{i.label}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="Terminy">
        <div className="grid grid-cols-2 gap-s5">
          <Field
            label={isA ? 'Data rozmowy wstępnej' : 'Data rozmowy rozpoczynającej'}
            htmlFor="field-initialTalkDate"
            issues={visible('initialTalkDate')}
            issuesId={popupId('initialTalkDate')}
            hint={
              isA ? (
                <>
                  Najpóźniej <DeadlineBadge due={d.initialTalkDue} today={now} done={!!d.initialTalkDate} doneOn={d.initialTalkDate} /> · 21 dni od zatrudnienia
                </>
              ) : (
                <>
                  Termin: <DeadlineBadge due={d.initialTalkDue} today={now} done={!!d.initialTalkDate} doneOn={d.initialTalkDate} />
                </>
              )
            }
          >
            <DateInput
              id="field-initialTalkDate"
              value={d.initialTalkDate}
              onChange={(v) => {
                touch('initialTalkDate');
                setDeadline('initialTalkDate', v);
              }}
              disabled={readOnly || done}
              min={isA ? employee.hireDate : undefined}
              max={now}
              reason={isA ? 'Od zatrudnienia do dziś — rozmowę zapisuje się po jej przeprowadzeniu' : 'Do dziś — rozmowę zapisuje się po jej przeprowadzeniu'}
              invalid={tone('initialTalkDate')}
              describedBy={popupId('initialTalkDate')}
            />
          </Field>
          {!isA && (
            <div>
              <p className="label">Termin sporządzenia oceny</p>
              <p className="mono text-lg">{formatPL(d.evaluationDueDate)}</p>
              <p className="hint">
                24 miesiące od poprzedniej oceny (art. 81 ust. 1 ustawy)
                {employee.absences.length > 0 && ', z przedłużeniem o nieobecności dłuższe niż miesiąc (art. 81 ust. 7)'}.
              </p>
            </div>
          )}
          {isA && (
            <>
              <Field
                label="Termin złożenia sprawozdania (od – do)"
                htmlFor="field-reportDue"
                issues={visible('reportDue')}
                issuesId={popupId('reportDue')}
                hint="Sprawozdanie obejmuje co najmniej 7 miesięcy pracy (§ 4 i § 6 rozp. z 2015 r.)."
              >
                <DateRangeInput
                  idFrom="field-reportDue"
                  from={d.reportDueFrom}
                  to={d.reportDueTo}
                  onChange={({ from, to }) => {
                    touch('reportDue');
                    setDeadlines({ reportDueFrom: from, reportDueTo: to });
                  }}
                  disabled={readOnly || done}
                  min={notBeforeTalk(legal?.reportDueFrom)}
                  max={legal?.evaluationWindowTo}
                  invalid={tone('reportDue')}
                  describedBy={popupId('reportDue')}
                  labelFrom="Termin złożenia sprawozdania — od"
                  labelTo="Termin złożenia sprawozdania — do"
                  reason="Po upływie 8 mies. od zatrudnienia, z czasem na ocenę"
                />
              </Field>
              <Field
                label="Okres dokonania pierwszej oceny (od – do)"
                htmlFor="field-evaluationWindow"
                issues={visible('evaluationWindow')}
                issuesId={popupId('evaluationWindow')}
                hint="Po upływie 8 miesięcy, nie później niż na miesiąc przed końcem umowy (art. 38 ust. 1 ustawy)."
              >
                <DateRangeInput
                  idFrom="field-evaluationWindow"
                  from={d.evaluationWindowFrom}
                  to={d.evaluationWindowTo}
                  onChange={({ from, to }) => {
                    touch('evaluationWindow');
                    setDeadlines({ evaluationWindowFrom: from, evaluationWindowTo: to, evaluationDueDate: to ?? d.evaluationDueDate });
                  }}
                  disabled={readOnly || done}
                  min={notBeforeTalk(legal?.evaluationWindowFrom)}
                  max={legal?.evaluationWindowTo}
                  invalid={tone('evaluationWindow')}
                  describedBy={popupId('evaluationWindow')}
                  labelFrom="Okres dokonania pierwszej oceny — od"
                  labelTo="Okres dokonania pierwszej oceny — do"
                  reason="Od 8 mies. od zatrudnienia do miesiąca przed końcem umowy"
                />
              </Field>
            </>
          )}
        </div>
      </Card>

      {!done && otherIssues.length > 0 && (
        <Alert tone={otherIssues.some(isBlocking) ? 'warning' : 'info'} title="Do uzupełnienia">
          <ul className="list-disc pl-5">
            {otherIssues.map((i) => (
              <li key={i.message}>{i.message}</li>
            ))}
          </ul>
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <button className="btn btn-secondary" onClick={pdf} disabled={pdfBusy}>
          {pdfBusy ? 'Generowanie…' : isA ? 'PDF: Części I–II (do podpisu)' : 'PDF: Część I (do podpisu)'}
        </button>
        {done ? (
          <button className="btn" onClick={next}>
            Dalej
          </button>
        ) : (
          // stays clickable: with errors it reveals every field message and focuses the first invalid field
          <button className="btn" onClick={tryConfirm} disabled={readOnly}>
            Potwierdzam przeprowadzenie rozmowy
          </button>
        )}
      </div>
    </div>
  );
}
