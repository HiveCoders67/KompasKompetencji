import {
  COMPETENCY_BY_CODE,
  FORM_SHORT,
  MANDATORY_CRITERIA,
  MAX_ADDITIONAL_CRITERIA,
  SCORE_LABELS,
  TYPE_LABELS,
  behaviorsForForm,
  findIndicator,
  previewResult,
  RESULT_LABELS,
  type CompetencyCode,
  type Employee,
  type Evaluation,
  type Osp,
  type FormType,
} from '@kompas/domain';
import { parseJsonObject, type LlmProvider } from './llm';

/*
 * Interview Assistant (docs/03 § 2.B) and OSP criteria suggestion (§ 2.C).
 * Advisory only: it never assigns scores; drafts reach the form only via „Wstaw do formularza” in the UI.
 */

export type InterviewTask = 'AGENDA' | 'FEEDBACK' | 'JUSTIFICATION' | 'DEVELOPMENT_PLAN' | 'DIFFICULT_TALK' | 'CHAT';

const TASKS: Record<InterviewTask, string> = {
  AGENDA:
    'Przygotuj agendę rozmowy i 6–10 konkretnych pytań otwartych. Dla rozmowy rozpoczynającej / wstępnej: omówienie obowiązków z OSP, kryteriów i wskaźników jako tematów, oczekiwań i terminów. Dla rozmowy oceniającej: omówienie realizacji obowiązków, poziomu spełniania kryteriów na podstawie notatek, potrzeb rozwojowych.',
  FEEDBACK:
    'Przełóż wybrane wskaźniki i notatki (evidence) na konstruktywną, neutralną emocjonalnie informację zwrotną według modelu FUKO (Fakty – Ustosunkowanie – Konsekwencje – Oczekiwania). Osobny akapit dla każdego kryterium, dla którego są notatki.',
  JUSTIFICATION:
    'Napisz szkic uzasadnienia oceny do arkusza (4–8 zdań), opierając się wyłącznie na notatkach i wybranych poziomach zachowań. Bez superlatyw, bez danych spoza materiału. Nie zmieniaj i nie proponuj ocen cząstkowych.',
  DEVELOPMENT_PLAN:
    'Napisz szkic wniosków dotyczących indywidualnego programu rozwoju zawodowego (3–6 punktów): obszary do doskonalenia wynikające z ocenianych kryteriów i zadań z OSP oraz proponowane formy (szkolenia, mentoring, zadania rozwojowe).',
  DIFFICULT_TALK:
    'Podpowiedz, jak przeprowadzić trudną rozmowę (np. ocena negatywna, rozbieżność z samooceną pracownika): przebieg, przykładowe sformułowania, czego unikać, jak zakończyć ustaleniami.',
  CHAT: 'Odpowiedz na pytanie przełożonego dotyczące przygotowania i prowadzenia rozmowy.',
};

const SYSTEM = `Jesteś Asystentem Rozmowy — coachem wspierającym przełożonego w służbie cywilnej w przygotowaniu rozmów oceniających i formułowaniu tekstów do arkusza.
Zasady: jesteś wyłącznie doradcą — NIGDY nie wystawiasz, nie sugerujesz ani nie zmieniasz ocen cząstkowych ani wyniku oceny i nie podejmujesz decyzji kadrowych. Opierasz się tylko na podanych materiałach (OSP, kryteria, wskaźniki z modelu kompetencji, notatki przełożonego); nie wymyślasz faktów o pracowniku — jeśli materiału brakuje, napisz, co przełożony powinien uzupełnić. Piszesz po polsku, rzeczowo, językiem urzędowym, bez emotikonów. Zwracasz zwykły tekst (dopuszczalne listy z „-”), bez nagłówków markdown.`;

export function evaluationMaterial(ev: Evaluation, employee: Employee, withScores: boolean): string {
  const osp = employee.osp;
  const criteria = ev.criteriaAssessments.map((c) => {
    const comp = COMPETENCY_BY_CODE[c.competencyId];
    const inds = c.indicatorAssessments
      .filter((i) => i.selected)
      .map((i) => {
        const ind = findIndicator(i.indicatorId);
        const level = i.level === null ? null : behaviorsForForm(ind!, ev.formType).find((b) => b.level === i.level);
        return `  - wskaźnik: ${ind?.label}${level ? `\n    zaobserwowane zachowanie (poziom „${SCORE_LABELS[i.level!]}”): ${level.description}` : ''}${i.evidence ? `\n    notatka przełożonego: ${i.evidence}` : ''}`;
      })
      .join('\n');
    const score = withScores && c.finalScore !== null ? ` — ocena cząstkowa wybrana przez przełożonego: ${c.finalScore} (${SCORE_LABELS[c.finalScore]})` : '';
    return `* ${comp.name}${c.isMandatory ? ' (obowiązkowe)' : ' (dodatkowe)'}${score}\n${inds}`;
  });
  const result = withScores ? previewResult(ev) : null;
  return [
    `Rodzaj: ${TYPE_LABELS[ev.type]}, ${FORM_SHORT[ev.formType]}. Oceniany: ${ev.employeeName}, ${osp.positionName}, ${osp.unit}.`,
    osp.purpose?.length ? `Cel stanowiska (OSP): ${osp.purpose.join(' ')}` : '',
    `Zadania (OSP):\n${osp.mainTasks.map((t) => `- ${t}`).join('\n')}`,
    `Kryteria i wskaźniki:\n${criteria.join('\n')}`,
    result ? `Wynik wyliczony przez system z ocen przełożonego: ${RESULT_LABELS[result.finalResult]}.` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

export async function interviewAssistant(
  llm: LlmProvider,
  task: InterviewTask,
  ev: Evaluation,
  employee: Employee,
  message?: string,
): Promise<string> {
  const withScores = task === 'JUSTIFICATION' || task === 'DIFFICULT_TALK' || task === 'DEVELOPMENT_PLAN';
  const user = `ZADANIE: ${TASKS[task]}\n\nMATERIAŁ:\n${evaluationMaterial(ev, employee, withScores)}${message ? `\n\nPYTANIE / UWAGI PRZEŁOŻONEGO: ${message}` : ''}`;
  return llm.generate({ system: SYSTEM, user, temperature: 0.5, maxOutputTokens: 1500 });
}

// ------------------------------------------------------------ OSP → additional criteria

export interface CriterionSuggestion {
  code: CompetencyCode;
  name: string;
  reason: string;
}

export async function suggestAdditionalCriteria(llm: LlmProvider, osp: Osp, formType: FormType): Promise<CriterionSuggestion[]> {
  if (formType === 'FIRST') return [];
  const mandatory = new Set(MANDATORY_CRITERIA[formType]);
  const catalogue = Object.values(COMPETENCY_BY_CODE).filter((c) => !mandatory.has(c.code));
  const user = `Stanowisko: ${osp.positionName} (${osp.symbol}), ${osp.unit}.
Cel stanowiska: ${(osp.purpose ?? []).join(' ') || '—'}
Zadania z OSP:
${osp.mainTasks.map((t, i) => `${i + 1}. ${t}`).join('\n')}
Kompetencje miękkie z OSP: ${osp.softCompetencies.map((c) => COMPETENCY_BY_CODE[c]?.name).join(', ') || '—'}
Czynniki utrudniające: ${(osp.difficultyFactors ?? []).join(', ') || '—'}

Katalog kryteriów dodatkowych do wyboru (kod — nazwa — opis wskaźników):
${catalogue.map((c) => `${c.code} — ${c.name} — ${c.indicators.map((i) => i.label).join(' ')}`).join('\n')}

Zaproponuj od 1 do ${MAX_ADDITIONAL_CRITERIA} kryteriów dodatkowych wyłącznie z katalogu, uzasadnione charakterem obowiązków. Każde uzasadnienie (1–2 zdania) ma powoływać się na konkretne zadania z OSP (podaj ich numery).
Zwróć WYŁĄCZNIE JSON: {"criteria": [{"code": "KOD", "reason": "uzasadnienie"}]}`;
  const raw = await llm.generate({
    system:
      'Jesteś asystentem analizującym opis stanowiska pracy (OSP) w służbie cywilnej. Tylko sugerujesz — ostateczny wybór należy do przełożonego. Odpowiadasz po polsku, wyłącznie poprawnym JSON-em.',
    user,
    temperature: 0.2,
    maxOutputTokens: 800,
    json: true,
  });
  const parsed = parseJsonObject<{ criteria?: { code?: string; reason?: string }[] }>(raw);
  const allowed = new Map(catalogue.map((c) => [c.code, c]));
  const out: CriterionSuggestion[] = [];
  for (const c of parsed?.criteria ?? []) {
    const comp = allowed.get(c.code as CompetencyCode);
    if (!comp || out.some((x) => x.code === comp.code) || !c.reason) continue;
    out.push({ code: comp.code, name: comp.name, reason: c.reason.trim() });
    if (out.length === MAX_ADDITIONAL_CRITERIA) break;
  }
  return out;
}
