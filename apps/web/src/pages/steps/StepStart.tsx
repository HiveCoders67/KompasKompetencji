import { useState } from 'react';
import {
  COMPETENCY_BY_CODE,
  FORM_SHORT,
  formatPL,
  initialTalkIssues,
  statusRank,
  today,
} from '@kompas/domain';
import { Alert, Card, DeadlineBadge, Field } from '../../components/ui';
import { DateInput } from '../../components/DateInput';
import { downloadEvaluationPdf } from '../../pdf/generate';
import type { StepProps } from './types';

export function StepStart({ ev, employee, update, readOnly, next }: StepProps) {
  const isA = ev.type === 'FIRST_EVALUATION';
  const d = ev.deadlines;
  const done = statusRank(ev) >= 1;
  const issues = initialTalkIssues(ev, employee);
  const [pdfBusy, setPdfBusy] = useState(false);
  const setDeadline = (key: keyof typeof d, value: string | null) => update((e) => ({ ...e, deadlines: { ...e.deadlines, [key]: value } }));

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
          <Field label={isA ? 'Data rozmowy wstępnej' : 'Data rozmowy rozpoczynającej'} htmlFor="initialTalkDate" hint={<>Termin: <DeadlineBadge due={d.initialTalkDue} today={today()} done={!!d.initialTalkDate} /></>}>
            <DateInput id="initialTalkDate" value={d.initialTalkDate} onChange={(v) => setDeadline('initialTalkDate', v)} disabled={readOnly || done} />
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
              <Field label="Termin złożenia sprawozdania (od – do)" hint="Sprawozdanie obejmuje co najmniej 7 miesięcy pracy (§ 4 i § 6 rozp. z 2015 r.).">
                <div className="flex items-center gap-2">
                  <DateInput value={d.reportDueFrom} onChange={(v) => setDeadline('reportDueFrom', v)} disabled={readOnly || done} />
                  <span>–</span>
                  <DateInput value={d.reportDueTo} onChange={(v) => setDeadline('reportDueTo', v)} disabled={readOnly || done} />
                </div>
              </Field>
              <Field label="Okres dokonania pierwszej oceny (od – do)" hint="Po upływie 8 miesięcy, nie później niż na miesiąc przed końcem umowy (art. 38 ust. 1 ustawy).">
                <div className="flex items-center gap-2">
                  <DateInput value={d.evaluationWindowFrom} onChange={(v) => setDeadline('evaluationWindowFrom', v)} disabled={readOnly || done} />
                  <span>–</span>
                  <DateInput value={d.evaluationWindowTo} onChange={(v) => update((e) => ({ ...e, deadlines: { ...e.deadlines, evaluationWindowTo: v, evaluationDueDate: v ?? e.deadlines.evaluationDueDate } }))} disabled={readOnly || done} />
                </div>
              </Field>
            </>
          )}
        </div>
      </Card>

      {!done && issues.length > 0 && (
        <Alert tone="warning" title="Do uzupełnienia">
          <ul className="list-disc pl-5">
            {issues.map((i) => (
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
          <button className="btn" onClick={confirm} disabled={readOnly || issues.length > 0}>
            Potwierdzam przeprowadzenie rozmowy
          </button>
        )}
      </div>
    </div>
  );
}
