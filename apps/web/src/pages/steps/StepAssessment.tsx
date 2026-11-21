import * as Checkbox from '@radix-ui/react-checkbox';
import * as RadioGroup from '@radix-ui/react-radio-group';
import { useState } from 'react';
import {
  COMPETENCY_BY_CODE,
  LEVEL_ONE_WARNING,
  MODEL_GUIDANCE,
  SCALE,
  SCORE_LABELS,
  behaviorsForForm,
  findIndicator,
  formatAverage,
  hasLevelOneIndicator,
  type CriterionAssessment,
  type Evaluation,
  type IndicatorAssessment,
  type Score,
} from '@kompas/domain';
import { Alert, Card } from '../../components/ui';
import type { StepProps } from './types';

export function StepAssessment({ ev, update, readOnly, next }: StepProps) {
  const [open, setOpen] = useState<string | null>(ev.criteriaAssessments.find((c) => c.finalScore === null)?.competencyId ?? null);
  const blocked = ev.status === 'DRAFT' || (ev.type === 'FIRST_EVALUATION' && ev.status === 'INITIAL_TALK_DONE');

  const patch = (code: string, fn: (c: CriterionAssessment) => CriterionAssessment) =>
    update((e: Evaluation) => ({ ...e, criteriaAssessments: e.criteriaAssessments.map((c) => (c.competencyId === code ? fn(c) : c)) }));
  const patchIndicator = (code: string, id: string, fn: (i: IndicatorAssessment) => IndicatorAssessment) =>
    patch(code, (c) => ({ ...c, indicatorAssessments: c.indicatorAssessments.map((i) => (i.indicatorId === id ? fn(i) : i)) }));

  const scored = ev.criteriaAssessments.filter((c) => c.finalScore !== null).length;

  return (
    <div className="flex flex-col gap-s5">
      {blocked && (
        <Alert tone="warning">
          {ev.type === 'FIRST_EVALUATION' ? 'Ocenę elementów rozpoczyna się po złożeniu sprawozdania (lub upływie terminu).' : 'Najpierw potwierdź przeprowadzenie rozmowy rozpoczynającej.'}
        </Alert>
      )}
      <Alert title="Jak oceniać wskaźniki (model kompetencji MC)">
        <ul className="list-disc pl-5">
          {MODEL_GUIDANCE.map((g) => (
            <li key={g}>{g}</li>
          ))}
        </ul>
      </Alert>

      <p className="hint">
        Ocenione kryteria: <strong className="text-fg">{scored}</strong> / {ev.criteriaAssessments.length}. System wylicza sugestię ze wskaźników — ocenę cząstkową
        wybierasz Ty i nie musisz uzasadniać odstępstwa.
      </p>

      {ev.criteriaAssessments.map((c) => {
        const comp = COMPETENCY_BY_CODE[c.competencyId];
        const expanded = open === c.competencyId;
        const selectedCount = c.indicatorAssessments.filter((i) => i.selected).length;
        return (
          <Card key={c.competencyId} className="!p-0">
            <button
              className="flex w-full items-center justify-between gap-s4 p-s5 text-left"
              onClick={() => setOpen(expanded ? null : c.competencyId)}
              aria-expanded={expanded}
            >
              <span>
                <span className="font-heading text-[22px] leading-tight tracking-[-0.017em]">{comp.name}</span>
                <span className="hint ml-s2">{c.isMandatory ? 'obowiązkowe' : 'dodatkowe'}</span>
              </span>
              <span className="flex items-center gap-s3">
                <SuggestionText c={c} />
                {c.finalScore !== null ? <span className="badge">ocena: {c.finalScore} pkt</span> : <span className="badge badge-outline">bez oceny</span>}
              </span>
            </button>

            {expanded && (
              <div className="flex flex-col gap-s4 border-t border-line p-s5">
                {c.indicatorAssessments.map((ia) => {
                  const ind = findIndicator(ia.indicatorId)!;
                  const behaviors = behaviorsForForm(ind, ev.formType);
                  const lastSelected = ia.selected && selectedCount === 1;
                  return (
                    <div key={ia.indicatorId} className={`rounded-lg border p-s4 ${ia.selected ? 'border-line-strong' : 'border-line opacity-80'}`}>
                      <label className="flex items-start gap-s3">
                        <Checkbox.Root
                          className="checkbox mt-1"
                          checked={ia.selected}
                          disabled={readOnly || blocked || lastSelected}
                          onCheckedChange={(v) => patchIndicator(c.competencyId, ia.indicatorId, (i) => ({ ...i, selected: v === true, level: v === true ? i.level : null }))}
                          aria-label={`Dobierz wskaźnik: ${ind.label}`}
                        >
                          <Checkbox.Indicator>✓</Checkbox.Indicator>
                        </Checkbox.Root>
                        <span>
                          <span className="font-semibold">{ind.label}</span>
                          {lastSelected && <span className="hint block text-xs">Minimum 1 wskaźnik na kryterium.</span>}
                        </span>
                      </label>

                      {ia.selected && (
                        <div className="mt-s3 pl-8">
                          <RadioGroup.Root
                            className={`grid gap-2 ${behaviors.length === 5 ? 'grid-cols-5' : 'grid-cols-3'}`}
                            value={ia.level === null ? '' : String(ia.level)}
                            onValueChange={(v) => patchIndicator(c.competencyId, ia.indicatorId, (i) => ({ ...i, level: Number(v) as Score }))}
                            disabled={readOnly || blocked}
                            aria-label={`Zaobserwowane zachowanie: ${ind.label}`}
                          >
                            {behaviors.map((b) => (
                              <RadioGroup.Item key={b.level} value={String(b.level)} className="radio-card !p-s3 text-[13px]">
                                <span className="mono block text-xs font-semibold">
                                  {b.level} · {SCORE_LABELS[b.level]}
                                </span>
                                <span className="mt-1 block">{b.description}</span>
                              </RadioGroup.Item>
                            ))}
                          </RadioGroup.Root>
                          <div className="mt-2 flex items-center gap-s3">
                            <button
                              className={`btn btn-sm ${ia.level === null ? 'btn-secondary' : 'btn-ghost'}`}
                              disabled={readOnly || blocked}
                              aria-pressed={ia.level === null}
                              onClick={() => patchIndicator(c.competencyId, ia.indicatorId, (i) => ({ ...i, level: null }))}
                            >
                              Brak podstaw do oceny
                            </button>
                            <span className="hint text-xs">{ia.level === null ? 'Brak podstaw — wskaźnik pominięty w sugestii (wybierz opis zachowania, jeśli je zaobserwowano).' : ''}</span>
                          </div>
                          <textarea
                            className="textarea mt-s3 text-sm"
                            rows={2}
                            placeholder="Notatka (opcjonalnie): sytuacja – działanie – rezultat"
                            value={ia.evidence ?? ''}
                            disabled={readOnly || blocked}
                            aria-label={`Notatka do wskaźnika: ${ind.label}`}
                            onChange={(e) => patchIndicator(c.competencyId, ia.indicatorId, (i) => ({ ...i, evidence: e.target.value || null }))}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}

                {ev.type === 'PERIODIC_EVALUATION' && hasLevelOneIndicator(c) && <Alert tone="warning">{LEVEL_ONE_WARNING}</Alert>}

                <div className="rounded-lg border border-line-strong p-s4">
                  <div className="flex items-center justify-between gap-s4">
                    <div>
                      <p className="label !mb-1">Ocena cząstkowa — decyzja przełożonego</p>
                      <SuggestionText c={c} long />
                    </div>
                    <RadioGroup.Root
                      className="flex gap-2"
                      value={c.finalScore === null ? '' : String(c.finalScore)}
                      onValueChange={(v) => patch(c.competencyId, (x) => ({ ...x, finalScore: Number(v) as Score }))}
                      disabled={readOnly || blocked}
                      aria-label={`Ocena cząstkowa: ${comp.name}`}
                    >
                      {SCALE[ev.formType].map((s) => (
                        <RadioGroup.Item key={s} value={String(s)} className="score-pill" title={SCORE_LABELS[s]}>
                          {s}
                        </RadioGroup.Item>
                      ))}
                    </RadioGroup.Root>
                  </div>
                  {c.finalScore !== null && (
                    <p className="hint mt-2">
                      {c.finalScore} pkt — {SCORE_LABELS[c.finalScore]}
                      {c.suggestedScore !== null && c.finalScore !== c.suggestedScore && ' · inna niż sugestia systemu (dozwolone, bez uzasadnienia)'}
                    </p>
                  )}
                  {ev.type === 'PERIODIC_EVALUATION' && c.finalScore === 1 && <div className="mt-2"><Alert tone="warning">{LEVEL_ONE_WARNING}</Alert></div>}
                </div>
              </div>
            )}
          </Card>
        );
      })}

      <div className="flex justify-end">
        <button className="btn" onClick={next} disabled={blocked}>
          Dalej: rozmowa oceniająca i wynik
        </button>
      </div>
    </div>
  );
}

function SuggestionText({ c, long }: { c: CriterionAssessment; long?: boolean }) {
  if (c.suggestedScore === null || c.suggestedMean === null) {
    return <span className="hint text-sm">{long ? 'Brak sugestii — wszystkie wskaźniki bez oceny lub „brak podstaw”.' : 'brak sugestii'}</span>;
  }
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      {long && <span className="badge badge-accent">Sugestia systemu na podstawie wskaźników</span>}
      <span className="mono">
        Średnia wskaźników {formatAverage(c.suggestedMean)} → sugestia {c.suggestedScore} pkt
      </span>
    </span>
  );
}
