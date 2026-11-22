import * as Checkbox from '@radix-ui/react-checkbox';
import * as RadioGroup from '@radix-ui/react-radio-group';
import { useEffect, useRef, useState } from 'react';
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
import { Alert, BlockedReasons, Card, RequiredMark } from '../../components/ui';
import { LockedStep } from './LockedStep';
import { stepLock, unfinishedCriteria } from './progress';
import type { StepProps } from './types';

/** Radio value for „brak podstaw do oceny” (stored as level = null). */
const NO_BASIS = 'none';

export function StepAssessment({ ev, update, readOnly, next, goTo }: StepProps) {
  // sections open independently — closing one automatically would shift the one being opened under the cursor
  const [open, setOpen] = useState<ReadonlySet<string>>(() => {
    const first = ev.criteriaAssessments.find((c) => c.finalScore === null)?.competencyId;
    return new Set(first ? [first] : []);
  });
  const toggle = (code: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (!next.delete(code)) next.add(code);
      return next;
    });
  const lock = stepLock(ev, 'assessment');
  const blocked = lock !== null;
  const unfinished = unfinishedCriteria(ev);
  /** Opens a criterion and brings it into view (from the „what is missing” hint under „Dalej”). */
  const showCriterion = (code: string) => {
    setOpen((prev) => new Set(prev).add(code));
    requestAnimationFrame(() => document.getElementById(`criterion-card-${code}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const patch = (code: string, fn: (c: CriterionAssessment) => CriterionAssessment) =>
    update((e: Evaluation) => ({ ...e, criteriaAssessments: e.criteriaAssessments.map((c) => (c.competencyId === code ? fn(c) : c)) }));
  const patchIndicator = (code: string, id: string, fn: (i: IndicatorAssessment) => IndicatorAssessment) =>
    patch(code, (c) => ({ ...c, indicatorAssessments: c.indicatorAssessments.map((i) => (i.indicatorId === id ? fn(i) : i)) }));

  return (
    <div className="flex flex-col gap-s5">
      {lock && <LockedStep lock={lock} goTo={goTo} ev={ev} />}
      <Alert title="Jak oceniać wskaźniki (model kompetencji MC)">
        <ul className="list-disc pl-5">
          {MODEL_GUIDANCE.map((g) => (
            <li key={g}>{g}</li>
          ))}
        </ul>
      </Alert>

      <AssessmentProgress criteria={ev.criteriaAssessments} onJump={showCriterion} />

      {ev.criteriaAssessments.map((c) => {
        const comp = COMPETENCY_BY_CODE[c.competencyId];
        const expanded = open.has(c.competencyId);
        const selectedCount = c.indicatorAssessments.filter((i) => i.selected).length;
        return (
          <Card key={c.competencyId} id={`criterion-card-${c.competencyId}`} className="criterion-card overflow-hidden !p-0">
            <button
              id={`criterion-head-${c.competencyId}`}
              className="disclosure-trigger flex w-full items-center justify-between gap-s4 p-s5 text-left"
              onClick={() => toggle(c.competencyId)}
              aria-expanded={expanded}
              aria-controls={`criterion-${c.competencyId}`}
            >
              <span>
                <span className="font-heading text-[22px] leading-tight tracking-[-0.017em]">{comp.name}</span>
                <span className="hint ml-s2">{c.isMandatory ? 'obowiązkowe' : 'dodatkowe'}</span>
              </span>
              <span className="flex items-center gap-s3">
                <SuggestionText c={c} />
                {c.finalScore !== null ? <span className="badge">ocena: {c.finalScore} pkt</span> : <span className="badge badge-outline">bez oceny</span>}
                <span className="disclosure-chevron" aria-hidden="true">
                  <Chevron />
                </span>
              </span>
            </button>

            {/* kept in the DOM so opening and closing can animate; inert while collapsed */}
            <div id={`criterion-${c.competencyId}`} className="sf-collapse" data-collapsed={!expanded} aria-hidden={!expanded} inert={!expanded}>
              <div className="sf-collapse-inner">
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

                        <div className="sf-collapse" data-collapsed={!ia.selected} aria-hidden={!ia.selected} inert={!ia.selected}>
                          <div className="sf-collapse-inner">
                            <div className="mt-s3 pl-8">
                              {/* „Brak podstaw” is one more option of the same group, so it is selected — and looks selected — like a behaviour card */}
                              <RadioGroup.Root
                                className={`grid gap-2 ${behaviors.length === 5 ? 'grid-cols-5' : 'grid-cols-3'}`}
                                value={ia.level === null ? NO_BASIS : String(ia.level)}
                                onValueChange={(v) =>
                                  patchIndicator(c.competencyId, ia.indicatorId, (i) => ({ ...i, level: v === NO_BASIS ? null : (Number(v) as Score) }))
                                }
                                disabled={readOnly || blocked}
                                aria-label={`Zaobserwowane zachowanie: ${ind.label}`}
                              >
                                {behaviors.map((b) => (
                                  <RadioGroup.Item
                                    key={b.level}
                                    value={String(b.level)}
                                    className="radio-card behavior-card !p-s3 text-[13px]"
                                  >
                                    <span className="block text-xs font-semibold tabular-nums">
                                      {b.level} · {SCORE_LABELS[b.level]}
                                    </span>
                                    <span className="mt-1 block">{b.description}</span>
                                  </RadioGroup.Item>
                                ))}
                                <RadioGroup.Item value={NO_BASIS} className="radio-card radio-card-none col-span-full !py-s2 !px-s3 text-[13px]">
                                  <span className="flex items-center gap-s2">
                                    <span className="radio-card-mark" aria-hidden="true" />
                                    <span className="font-semibold">Brak podstaw do oceny</span>
                                    <span className="hint text-xs">
                                      {ia.level === null
                                        ? '— wskaźnik pominięty w sugestii; wybierz opis zachowania, jeśli je zaobserwowano'
                                        : '— nie było okazji zaobserwować zachowania'}
                                    </span>
                                  </span>
                                </RadioGroup.Item>
                              </RadioGroup.Root>
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
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {ev.type === 'PERIODIC_EVALUATION' && hasLevelOneIndicator(c) && <Alert tone="warning">{LEVEL_ONE_WARNING}</Alert>}

                  <div className="rounded-lg border border-line-strong p-s4">
                    <div className="flex items-center justify-between gap-s4">
                      <div>
                        <p className="label !mb-1">
                        Ocena cząstkowa — decyzja przełożonego
                        <RequiredMark />
                      </p>
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
              </div>
            </div>
          </Card>
        );
      })}

      <div className="flex justify-end">
        <button
          className="btn"
          onClick={next}
          disabled={blocked || unfinished.length > 0}
          aria-describedby={blocked || unfinished.length ? 'assessment-blockers' : undefined}
        >
          Dalej: rozmowa oceniająca i wynik
        </button>
      </div>
      <BlockedReasons
        id="assessment-blockers"
        reasons={
          lock
            ? [lock.reason]
            : unfinished.length
              ? [
                  <>
                    Wybierz ocenę cząstkową dla:{' '}
                    {unfinished.map((code, i) => (
                      <span key={code}>
                        {i > 0 && ', '}
                        <button className="underline" onClick={() => showCriterion(code)}>
                          {COMPETENCY_BY_CODE[code as keyof typeof COMPETENCY_BY_CODE].name}
                        </button>
                      </span>
                    ))}
                    .
                  </>,
                ]
              : []
        }
      />
    </div>
  );
}

/**
 * Sticky bar on top of the assessment step: how many criteria are scored (progress bar) and which criterion
 * is currently on screen. Each criterion chip jumps to its section.
 */
function AssessmentProgress({ criteria, onJump }: { criteria: CriterionAssessment[]; onJump: (code: string) => void }) {
  const bar = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [stuck, setStuck] = useState(false);
  const scored = criteria.filter((c) => c.finalScore !== null).length;
  const total = criteria.length;
  const codes = criteria.map((c) => c.competencyId).join(',');

  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const el = bar.current;
      if (!el) return;
      const bottom = el.getBoundingClientRect().bottom;
      setStuck(el.getBoundingClientRect().top <= 0.5 && window.scrollY > 0);
      // the current section = the last criterion whose card starts above the bar's lower edge (+ a little slack)
      let found: string | null = null;
      for (const code of codes.split(',')) {
        const card = document.getElementById(`criterion-card-${code}`);
        if (card && card.getBoundingClientRect().top <= bottom + 24) found = code;
      }
      setCurrent(found);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [codes]);

  const idx = current ? criteria.findIndex((c) => c.competencyId === current) : -1;
  const pct = total ? Math.round((scored / total) * 100) : 0;

  return (
    <div ref={bar} className="assessment-progress" data-stuck={stuck}>
      <div className="flex items-center justify-between gap-s4">
        <p className="min-w-0 truncate text-sm" aria-live="polite">
          {idx >= 0 ? (
            <>
              <span className="hint tabular-nums">
                Kryterium {idx + 1}/{total}
              </span>{' '}
              <strong>{COMPETENCY_BY_CODE[criteria[idx].competencyId].name}</strong>
            </>
          ) : (
            <span className="hint">System wylicza sugestię ze wskaźników — ocenę cząstkową wybierasz Ty i nie musisz uzasadniać odstępstwa.</span>
          )}
        </p>
        <p className="shrink-0 text-sm">
          Ocenione kryteria: <strong className="tabular-nums">{scored}</strong>
          <span className="hint tabular-nums"> / {total}</span>
          {scored === total && <span className="ml-s2 font-semibold text-success">✓ gotowe</span>}
        </p>
      </div>
      <div
        className="assessment-progress-track mt-s2"
        role="progressbar"
        aria-label="Ocenione kryteria"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={scored}
        aria-valuetext={`${scored} z ${total} kryteriów ocenionych`}
      >
        <div className="assessment-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <ol className="mt-s2 flex flex-wrap gap-1">
        {criteria.map((c, i) => {
          const done = c.finalScore !== null;
          const here = c.competencyId === current;
          return (
            <li key={c.competencyId}>
              <button
                className="assessment-chip"
                data-done={done}
                aria-current={here ? 'location' : undefined}
                onClick={() => onJump(c.competencyId)}
                title={COMPETENCY_BY_CODE[c.competencyId].name}
              >
                <span className="tabular-nums">{i + 1}.</span> {COMPETENCY_BY_CODE[c.competencyId].name}
                <span className="sr-only">{done ? ` — ocena ${c.finalScore} pkt` : ' — bez oceny'}</span>
                {done && (
                  <span aria-hidden="true" className="ml-1">
                    ✓
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
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
      <span className="tabular-nums">
        Średnia wskaźników {formatAverage(c.suggestedMean)} → sugestia {c.suggestedScore} pkt
      </span>
    </span>
  );
}

function Chevron() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}
