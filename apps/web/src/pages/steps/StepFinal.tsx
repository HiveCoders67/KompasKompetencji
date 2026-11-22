import * as RadioGroup from '@radix-ui/react-radio-group';
import * as Switch from '@radix-ui/react-switch';
import {
  COMPETENCY_BY_CODE,
  EXAM_LABELS,
  LEVEL_LABELS,
  RESULT_LABELS,
  computeFirstResult,
  computePeriodicResult,
  blockingIssues,
  completionIssues,
  today,
  formatAverage,
  previewResult,
  promotionApplicable,
  statusRank,
  type ExamPassed,
  type Score,
} from '@kompas/domain';
import { AiTextField } from '../../components/AiTextField';
import { DateInput } from '../../components/DateInput';
import { Alert, BlockedReasons, Card, Field } from '../../components/ui';
import { LockedStep } from './LockedStep';
import { stepLock } from './progress';
import type { StepProps } from './types';

export function StepFinal({ ev, employee, update, readOnly, next, goTo }: StepProps) {
  const lock = stepLock(ev, 'final');
  if (lock) return <LockedStep lock={lock} goTo={goTo} ev={ev} />;

  const isA = ev.type === 'FIRST_EVALUATION';
  const result = previewResult(ev);
  const scores = ev.criteriaAssessments.map((c) => c.finalScore);
  const allScored = scores.every((s) => s !== null);
  const req = ev.firstEvalRequirements;
  const detail = allScored
    ? isA
      ? req?.examPassed && req.reportSubmittedOnTime
        ? computeFirstResult(scores as Score[], req.examPassed, req.reportSubmittedOnTime).conditions
        : null
      : computePeriodicResult(scores as Score[]).reasons
    : null;
  const negative = result?.finalResult === 'NEGATIVE';
  const finalDone = statusRank(ev) >= 3;
  const promo = promotionApplicable(ev, employee);
  const pr = ev.promotionRequest;

  const setText = (key: 'justification' | 'developmentPlan', v: string | null) =>
    update((e) => ({ ...e, texts: { ...e.texts, [key]: v, [`${key}AiDraft`]: false } }));

  const scored = scores.filter((s) => s !== null).length;
  // everything this step requires (date, exam result, justification of a negative result, development plan, Part III)
  // — the same rules that later block completion, so the talk cannot be confirmed with a required field left empty
  const stepIssues = blockingIssues(completionIssues(ev, employee, today())).filter((i) => i.step === 'final');
  const confirmBlockers = [
    ...stepIssues.map((i) => i.message),
    !allScored && (
      <>
        Wybierz oceny cząstkowe dla wszystkich kryteriów — ocenione {scored} z {scores.length}.{' '}
        <button className="underline" onClick={() => goTo('assessment')}>
          Przejdź do oceny
        </button>
      </>
    ),
  ].filter(Boolean) as React.ReactNode[];

  const confirmTalk = () => update((e) => ({ ...e, status: 'FINAL_TALK_DONE', currentStep: 'complete' }));

  return (
    <div className="flex flex-col gap-s5">
      <Alert title={isA ? 'Rozmowa oceniająca (§ 8 rozp. z 2015 r.)' : 'Rozmowa oceniająca (§ 10 rozp. z 2016 r.)'}>
        {isA
          ? 'Omów z ocenianym postawę, zaangażowanie i postępy w okresie służby przygotowawczej oraz sposób wykonywania obowiązków.'
          : 'Omów z ocenianym sposób wykonywania obowiązków, poziom spełniania kryteriów oraz potrzeby rozwojowe. Asystent rozmowy przygotuje agendę i informację zwrotną.'}
      </Alert>

      <Card title="Rozmowa i warunki">
        <div className="grid grid-cols-2 gap-s5">
          <Field label="Data rozmowy oceniającej" htmlFor="finalTalkDate" required>
            <DateInput
              id="finalTalkDate"
              value={ev.deadlines.finalTalkDate}
              min={ev.deadlines.initialTalkDate}
              onChange={(v) => update((e) => ({ ...e, deadlines: { ...e.deadlines, finalTalkDate: v } }))}
              disabled={readOnly}
            />
          </Field>
          {isA && (
            <Field label="Egzamin ze służby przygotowawczej" required hint="Zwolnienie ze służby przygotowawczej (art. 36 ust. 7) nie zwalnia z egzaminu (art. 36 ust. 8 ustawy).">
              <RadioGroup.Root
                className="flex gap-2"
                value={req?.examPassed ?? ''}
                onValueChange={(v) => update((e) => ({ ...e, firstEvalRequirements: { reportSubmittedOnTime: e.firstEvalRequirements?.reportSubmittedOnTime ?? null, examPassed: v as ExamPassed } }))}
                disabled={readOnly}
                aria-label="Zaliczenie egzaminu"
              >
                {(['YES', 'NO', 'NOT_APPLICABLE'] as ExamPassed[]).map((x) => (
                  <RadioGroup.Item key={x} value={x} className="radio-card !w-auto">
                    {EXAM_LABELS[x]}
                  </RadioGroup.Item>
                ))}
              </RadioGroup.Root>
            </Field>
          )}
          {isA && (
            <div>
              <p className="label">Sprawozdanie złożone w terminie</p>
              <p>{req?.reportSubmittedOnTime === 'YES' ? 'TAK' : req?.reportSubmittedOnTime === 'NO' ? 'NIE' : '—'}</p>
              <p className="hint">Z kroku „Sprawozdanie”.</p>
            </div>
          )}
        </div>
      </Card>

      <Card title="Wynik (wyliczany w kodzie z ocen cząstkowych)">
        <table className="table mb-s4">
          <thead>
            <tr>
              <th>{isA ? 'Element' : 'Kryterium'}</th>
              <th>Sugestia systemu</th>
              <th>Ocena cząstkowa przełożonego</th>
            </tr>
          </thead>
          <tbody>
            {ev.criteriaAssessments.map((c) => (
              <tr key={c.competencyId}>
                <td>{COMPETENCY_BY_CODE[c.competencyId].name}</td>
                <td className="mono">{c.suggestedScore ?? '—'}</td>
                <td className="mono font-semibold">{c.finalScore ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!result ? (
          <Alert tone="warning">
            {allScored ? 'Uzupełnij warunki pierwszej oceny (egzamin, sprawozdanie), aby zobaczyć wynik.' : 'Wybierz oceny cząstkowe dla wszystkich kryteriów w kroku „Ocena wskaźników”.'}
          </Alert>
        ) : (
          <div className="flex flex-col gap-s3">
            <div className="flex flex-wrap items-center gap-s5">
              <div>
                <p className="hint">{isA ? 'Ocena łączna (średnia)' : 'Średnia arytmetyczna'}</p>
                <p className="mono text-[26px]">{formatAverage(result.averageScore)}</p>
              </div>
              {result.overallLevel && (
                <div>
                  <p className="hint">Ogólny poziom spełniania kryteriów</p>
                  <p className="font-semibold">{LEVEL_LABELS[result.overallLevel]}</p>
                </div>
              )}
              <div>
                <p className="hint">{isA ? 'Pierwsza ocena' : 'Ocena okresowa'}</p>
                <span className={`badge ${negative ? 'badge-error' : 'badge-success'} text-sm`}>{RESULT_LABELS[result.finalResult]}</span>
              </div>
            </div>
            {Array.isArray(detail) && detail.length > 0 && (
              <ul className="hint list-disc pl-5">
                {detail.map((d) =>
                  typeof d === 'string' ? (
                    <li key={d}>{d}</li>
                  ) : (
                    <li key={d.label} className={d.met ? '' : 'text-error'}>
                      {d.met ? '✓' : '✗'} {d.label}
                    </li>
                  ),
                )}
              </ul>
            )}
          </div>
        )}
      </Card>

      <Card title="Uzasadnienie i rozwój zawodowy">
        <div className="flex flex-col gap-s4">
          <AiTextField
            id="justification"
            label={isA ? 'Uzasadnienie przyznanej pierwszej oceny' : 'Uzasadnienie przyznanej oceny okresowej'}
            required={negative}
            hint={negative ? 'Obowiązkowe przy ocenie negatywnej.' : 'Fakultatywne przy ocenie pozytywnej.'}
            value={ev.texts.justification}
            aiDraft={ev.texts.justificationAiDraft}
            disabled={readOnly}
            onChange={(v) => setText('justification', v)}
          />
          {(!isA || !negative) && (
            <AiTextField
              id="developmentPlan"
              label={isA ? 'Wnioski dotyczące rozwoju zawodowego (Część VI)' : 'Wnioski dotyczące indywidualnego programu rozwoju zawodowego'}
              required={!isA}
              hint={isA ? 'Tylko przy ocenie pozytywnej.' : 'Obowiązkowe (art. 81 ust. 5 ustawy).'}
              value={ev.texts.developmentPlan}
              aiDraft={ev.texts.developmentPlanAiDraft}
              disabled={readOnly}
              onChange={(v) => setText('developmentPlan', v)}
            />
          )}
          <p className="hint">Asystent AI może przygotować szkic — trafia do formularza dopiero po kliknięciu „Wstaw do formularza”.</p>
        </div>
      </Card>

      {!isA && employee.employmentType === 'CIVIL_SERVANT' && (
        <Card title="Część III — wniosek o przyznanie kolejnego stopnia służbowego (art. 89 ust. 1)">
          {!promo ? (
            <p className="hint">Dostępne wyłącznie przy ocenie pozytywnej urzędnika służby cywilnej.</p>
          ) : (
            <div className="flex flex-col gap-s4">
              <label className="flex items-center gap-s3">
                <Switch.Root
                  className="switch"
                  checked={pr.included}
                  disabled={readOnly}
                  onCheckedChange={(v) => update((e) => ({ ...e, promotionRequest: { ...e.promotionRequest, included: v } }))}
                >
                  <Switch.Thumb className="switch-thumb" />
                </Switch.Root>
                Dołącz wniosek do arkusza
              </label>
              {pr.included && (
                <div className="grid grid-cols-2 gap-s4">
                  <Field label="Rok mianowania">
                    <input className="input" type="number" value={pr.appointmentYear ?? ''} disabled={readOnly}
                      onChange={(e) => update((x) => ({ ...x, promotionRequest: { ...x.promotionRequest, appointmentYear: e.target.value ? Number(e.target.value) : null } }))} />
                  </Field>
                  <Field label="Posiadany stopień służbowy">
                    <input className="input" value={pr.currentRank ?? ''} disabled={readOnly}
                      onChange={(e) => update((x) => ({ ...x, promotionRequest: { ...x.promotionRequest, currentRank: e.target.value || null } }))} />
                  </Field>
                  <Field label="Data przyznania posiadanego stopnia">
                    <DateInput value={pr.currentRankGrantedAt} disabled={readOnly}
                      onChange={(v) => update((x) => ({ ...x, promotionRequest: { ...x.promotionRequest, currentRankGrantedAt: v } }))} />
                  </Field>
                  <Field label="Wnioskowany stopień służbowy" required>
                    <input className="input" value={pr.requestedRank ?? ''} disabled={readOnly}
                      onChange={(e) => update((x) => ({ ...x, promotionRequest: { ...x.promotionRequest, requestedRank: e.target.value || null } }))} />
                  </Field>
                  <div className="col-span-2">
                    <Field label="Umotywowanie wniosku" required>
                      <textarea className="textarea" rows={3} value={pr.motivation ?? ''} disabled={readOnly}
                        onChange={(e) => update((x) => ({ ...x, promotionRequest: { ...x.promotionRequest, motivation: e.target.value || null } }))} />
                    </Field>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      <div className="flex justify-end">
        {finalDone ? (
          <button className="btn" onClick={next}>
            Dalej: zatwierdzenie
          </button>
        ) : (
          <button
            className="btn"
            onClick={confirmTalk}
            disabled={readOnly || confirmBlockers.length > 0}
            aria-describedby={confirmBlockers.length ? 'final-blockers' : undefined}
          >
            Potwierdzam przeprowadzenie rozmowy oceniającej
          </button>
        )}
      </div>
      {!finalDone && !readOnly && <BlockedReasons id="final-blockers" reasons={confirmBlockers} />}
    </div>
  );
}
