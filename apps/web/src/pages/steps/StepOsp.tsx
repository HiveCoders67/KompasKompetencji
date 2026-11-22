import * as RadioGroup from '@radix-ui/react-radio-group';
import * as Checkbox from '@radix-ui/react-checkbox';
import { useState } from 'react';
import {
  COMPETENCIES,
  COMPETENCY_BY_CODE,
  DEMO_OSP_PROFILES,
  FORM_B_WARNING,
  FORM_SHORT,
  MANDATORY_CRITERIA,
  MAX_ADDITIONAL_CRITERIA,
  SUBORDINATES_LABELS,
  needsManagementConfirmation,
  parseOspDocx,
  resolveForm,
  setAdditionalCriteria,
  switchForm,
  toOsp,
  type CompetencyCode,
  type Osp,
  type ParsedOsp,
} from '@kompas/domain';
import { Alert, BlockedReasons, Card, RequiredMark } from '../../components/ui';
import { callableError, saveEmployeeOsp, suggestCriteriaFn } from '../../data/repo';
import type { StepProps } from './types';

export function StepOsp({ ev, employee, update, setEmployee, readOnly, next, flush }: StepProps) {
  const osp = employee.osp;
  const [parsed, setParsed] = useState<ParsedOsp | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<{ code: CompetencyCode; name: string; reason: string }[] | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const additional = ev.criteriaAssessments.filter((c) => !c.isMandatory).map((c) => c.competencyId);
  const mandatory = MANDATORY_CRITERIA[ev.formType];
  const allSuggestionsAdded = !!suggestions?.length && suggestions.every((s) => additional.includes(s.code));
  const formResolved = resolveForm(osp);

  const applyOsp = async (next: Osp) => {
    setSaving(true);
    try {
      await saveEmployeeOsp(employee.id, next);
      setEmployee({ ...employee, osp: next });
      const form = resolveForm(next);
      if (form && form !== ev.formType) update((e) => switchForm(e, form));
    } finally {
      setSaving(false);
    }
  };

  const onFile = async (file: File) => {
    setParseError(null);
    setParsed(null);
    try {
      setParsed(parseOspDocx(new Uint8Array(await file.arrayBuffer())));
    } catch (e) {
      setParseError((e as Error).message);
    }
  };

  const confirmParsed = async () => {
    if (!parsed) return;
    await applyOsp(toOsp(parsed));
    setParsed(null);
    setSuggestions(null);
  };

  const confirmManagement = (value: boolean) => applyOsp({ ...osp, managementConfirmed: value });

  const toggleAdditional = (code: CompetencyCode, on: boolean) => {
    const list = on ? [...additional, code] : additional.filter((c) => c !== code);
    if (list.length > MAX_ADDITIONAL_CRITERIA) return;
    update((e) => setAdditionalCriteria(e, list));
  };

  const askAi = async () => {
    setAiBusy(true);
    setAiError(null);
    try {
      await flush();
      setSuggestions((await suggestCriteriaFn({ evaluationId: ev.id, osp, formType: ev.formType })).criteria);
    } catch (e) {
      setAiError(callableError(e));
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-s5">
      <Card
        title="Opis stanowiska pracy (OSP)"
        actions={
          !readOnly && (
            <div className="flex items-center gap-s2">
              <label className="btn btn-secondary btn-sm cursor-pointer">
                Wgraj plik OSP (DOCX)
                <input type="file" accept=".docx" className="sr-only" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
              </label>
              <select
                className="select text-sm"
                aria-label="Wczytaj przykładowy OSP z danych demo"
                value=""
                onChange={(e) => {
                  const p = DEMO_OSP_PROFILES.find((x) => x.file === e.target.value);
                  if (p) setParsed(p.parsed);
                }}
              >
                <option value="">Wczytaj przykładowy OSP…</option>
                {DEMO_OSP_PROFILES.map((p) => (
                  <option key={p.file} value={p.file}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          )
        }
      >
        {parseError && <Alert tone="error" title="Nie udało się odczytać pliku">{parseError}</Alert>}
        {parsed ? (
          <div className="flex flex-col gap-s4">
            <Alert title="Wynik parsowania — sprawdź i zatwierdź">Parser odczytał pola strukturalne z szablonu MC. Zatwierdzenie zapisze OSP w profilu pracownika.</Alert>
            {/* the parse result is being checked — show every task */}
            <OspView osp={{ ...toOsp(parsed) }} warnings={parsed.warnings} allTasks />
            <div className="flex gap-s2">
              <button className="btn" onClick={confirmParsed} disabled={saving}>
                Zatwierdź wynik parsowania
              </button>
              <button className="btn btn-ghost" onClick={() => setParsed(null)}>
                Anuluj
              </button>
            </div>
          </div>
        ) : (
          <OspView osp={osp} />
        )}
      </Card>

      <Card title="Dobór arkusza (§ 3 rozp. z 2016 r.)">
        <p className="mb-s3">
          Podległość z OSP: <strong>{SUBORDINATES_LABELS[osp.subordinates]}</strong>
        </p>
        {needsManagementConfirmation(osp) ? (
          <div className="flex flex-col gap-s3">
            <Alert tone="warning">{FORM_B_WARNING}</Alert>
            <p className="label !mb-0" id="management-label">
              Charakter pracy na stanowisku
              <RequiredMark />
            </p>
            <RadioGroup.Root
              className="grid grid-cols-2 gap-s2"
              value={osp.managementConfirmed === null ? '' : String(osp.managementConfirmed)}
              onValueChange={(v) => confirmManagement(v === 'true')}
              disabled={readOnly || saving}
              aria-labelledby="management-label"
              aria-required="true"
            >
              <RadioGroup.Item value="true" className="radio-card">
                <strong>Bezpośrednio kieruje pracownikami</strong>
                <span className="hint block">Arkusz B (zał. nr 3)</span>
              </RadioGroup.Item>
              <RadioGroup.Item value="false" className="radio-card">
                <strong>Wyłącznie koordynuje, nie kieruje</strong>
                <span className="hint block">Arkusz C (zał. nr 4)</span>
              </RadioGroup.Item>
            </RadioGroup.Root>
          </div>
        ) : (
          <Alert tone="success">Brak podległych pracowników → {FORM_SHORT.FORM_C} (§ 3 ust. 4 rozp. z 2016 r.).</Alert>
        )}
        {formResolved && (
          <p className="mt-s3">
            Arkusz oceny: <strong>{FORM_SHORT[ev.formType]}</strong>
          </p>
        )}
      </Card>

      <Card
        title="Kryteria oceny"
        actions={
          !readOnly && (
            <button className="btn btn-secondary btn-sm" onClick={askAi} disabled={aiBusy}>
              {aiBusy ? 'Analiza OSP…' : 'Zaproponuj kryteria dodatkowe (AI)'}
            </button>
          )
        }
      >
        <p className="label">Obowiązkowe dla {FORM_SHORT[ev.formType]} (§ 4 rozp. z 2016 r.)</p>
        <ul className="mb-s4 flex flex-wrap gap-2">
          {mandatory.map((c) => (
            <li key={c} className="badge badge-outline">
              {COMPETENCY_BY_CODE[c].name}
            </li>
          ))}
        </ul>

        {aiError && <Alert tone="error">{aiError}</Alert>}
        {suggestions && (
          // a suggestion collapses once its criterion is added (it reappears if the criterion is unchecked below);
          // the whole block collapses when every suggestion has been added
          <div className="sf-collapse" data-collapsed={allSuggestionsAdded} aria-hidden={allSuggestionsAdded} inert={allSuggestionsAdded}>
            <div className="sf-collapse-inner">
              <div className="mb-s4">
                <p className="label mb-s2">Sugestie AI na podstawie zadań z OSP — wybór należy do Ciebie</p>
                {suggestions.length === 0 && <p className="hint">Model nie zaproponował kryteriów dodatkowych.</p>}
                {suggestions.map((s) => {
                  const added = additional.includes(s.code);
                  return (
                    <div key={s.code} className="sf-collapse" data-collapsed={added} aria-hidden={added} inert={added}>
                      <div className="sf-collapse-inner">
                        <div className="pb-s2">
                          <div className="flex items-start justify-between gap-s3 rounded-lg border border-line p-s3">
                            <div>
                              <p className="font-semibold">{s.name}</p>
                              <p className="hint">{s.reason}</p>
                            </div>
                            <button
                              className="btn btn-secondary btn-sm"
                              disabled={readOnly || added || additional.length >= MAX_ADDITIONAL_CRITERIA}
                              onClick={() => toggleAdditional(s.code, true)}
                            >
                              Dodaj
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <p className="label">
          Dodatkowe (nie więcej niż {MAX_ADDITIONAL_CRITERIA}) — wybrano {additional.length}
        </p>
        <div className="grid grid-cols-3 gap-s2">
          {COMPETENCIES.filter((c) => !mandatory.includes(c.code)).map((c) => {
            const checked = additional.includes(c.code);
            const fromOsp = osp.softCompetencies.includes(c.code);
            return (
              <label key={c.code} className={`flex items-start gap-s2 rounded-lg border p-s2 text-sm ${checked ? 'border-fg' : 'border-line'}`}>
                <Checkbox.Root
                  className="checkbox mt-0.5"
                  checked={checked}
                  disabled={readOnly || (!checked && additional.length >= MAX_ADDITIONAL_CRITERIA)}
                  onCheckedChange={(v) => toggleAdditional(c.code, v === true)}
                >
                  <Checkbox.Indicator>✓</Checkbox.Indicator>
                </Checkbox.Root>
                <span>
                  {c.name}
                  {fromOsp && <span className="hint block text-xs">w kompetencjach miękkich OSP</span>}
                </span>
              </label>
            );
          })}
        </div>
      </Card>

      <div className="flex justify-end">
        <button className="btn" onClick={next} disabled={!formResolved} aria-describedby={!formResolved ? 'osp-blockers' : undefined}>
          Dalej: rozpocznij ocenę
        </button>
      </div>
      <BlockedReasons
        id="osp-blockers"
        reasons={formResolved ? [] : ['Wskaż w sekcji „Dobór arkusza”, czy praca na stanowisku polega na bezpośrednim kierowaniu pracownikami.']}
      />
    </div>
  );
}

/** Tasks shown before „Pokaż wszystkie” — enough to recognise the position without a wall of text. */
const VISIBLE_TASKS = 3;

function OspView({ osp, warnings, allTasks = false }: { osp: Osp; warnings?: string[]; allTasks?: boolean }) {
  const [tasksOpen, setTasksOpen] = useState(allTasks);
  const shown = osp.mainTasks.slice(0, VISIBLE_TASKS);
  const rest = osp.mainTasks.slice(VISIBLE_TASKS);
  return (
    <div className="flex flex-col gap-s3">
      {warnings && warnings.length > 0 && <Alert tone="warning" title="Uwagi parsera">{warnings.join(' ')}</Alert>}
      <dl className="grid grid-cols-[220px_1fr] gap-x-s4 gap-y-2 text-sm">
        <dt className="hint">Stanowisko</dt>
        <dd>
          {osp.positionName} <span className="mono">({osp.symbol})</span>
        </dd>
        <dt className="hint">Komórka</dt>
        <dd>
          {osp.department}
          {osp.unit && osp.unit !== osp.department ? `, ${osp.unit}` : ''}
        </dd>
        <dt className="hint">Bezpośrednio nadzorujące</dt>
        <dd>{osp.directSupervisorPosition || '—'}</dd>
        <dt className="hint">Podległość</dt>
        <dd>{SUBORDINATES_LABELS[osp.subordinates]}</dd>
        {osp.purpose && osp.purpose.length > 0 && (
          <>
            <dt className="hint">Cel stanowiska</dt>
            <dd>{osp.purpose.join(' ')}</dd>
          </>
        )}
        <dt className="hint">Zadania</dt>
        <dd>
          <ol className="list-decimal pl-5">
            {shown.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ol>
          {rest.length > 0 && (
            <>
              <div id="osp-more-tasks" className="sf-collapse" data-collapsed={!tasksOpen} aria-hidden={!tasksOpen} inert={!tasksOpen}>
                <div className="sf-collapse-inner">
                  <ol className="list-decimal pl-5" start={VISIBLE_TASKS + 1}>
                    {rest.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ol>
                </div>
              </div>
              {!allTasks && (
                <button
                  type="button"
                  className="show-more btn btn-ghost btn-sm mt-1 !px-2"
                  aria-expanded={tasksOpen}
                  aria-controls="osp-more-tasks"
                  onClick={() => setTasksOpen((o) => !o)}
                >
                  {tasksOpen ? 'Zwiń zadania' : `Pokaż wszystkie zadania (${osp.mainTasks.length})`}
                  <svg className="show-more-chevron" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3.5 6L8 10.5 12.5 6" />
                  </svg>
                </button>
              )}
            </>
          )}
        </dd>
        <dt className="hint">Kompetencje miękkie</dt>
        <dd>{osp.softCompetencies.map((c) => COMPETENCY_BY_CODE[c].name).join(', ') || '—'}</dd>
        {osp.authorizations && (
          <>
            <dt className="hint">Upoważnienia</dt>
            <dd>{osp.authorizations.join(', ') || '—'}</dd>
          </>
        )}
        {osp.difficultyFactors && (
          <>
            <dt className="hint">Czynniki utrudniające</dt>
            <dd>{osp.difficultyFactors.join(', ') || '—'}</dd>
          </>
        )}
      </dl>
    </div>
  );
}
