import data from '../data/competencies.json';
import type { Behavior, Competency, CompetencyCode, FormType, Indicator } from './types';

/*
 * MC competency model: 14 competencies, 49 behavioural indicators, 5 levels (docs/02 § 3.1).
 * Generated from knowledge/sources/model/model-kompetencji.xlsx by
 * knowledge/scripts/build_competencies.py — the single source of truth for UI, seed and RAG.
 */

export const COMPETENCIES = data.competencies as Competency[];
/** Guidance from the model's introduction sheet, shown next to indicator assessment. */
export const MODEL_GUIDANCE: string[] = data.guidance;

export const COMPETENCY_BY_CODE = Object.fromEntries(COMPETENCIES.map((c) => [c.code, c])) as Record<CompetencyCode, Competency>;

const INDICATOR_INDEX = new Map<string, { competency: Competency; indicator: Indicator }>(
  COMPETENCIES.flatMap((c) => c.indicators.map((i) => [i.id, { competency: c, indicator: i }] as const)),
);

export function competencyName(code: CompetencyCode): string {
  return COMPETENCY_BY_CODE[code]?.name ?? code;
}

export function findIndicator(id: string): Indicator | undefined {
  return INDICATOR_INDEX.get(id)?.indicator;
}

/** Path A shows only the „poniżej / na poziomie / powyżej oczekiwań” columns (docs/02 § 3.3). */
export function behaviorsForForm(indicator: Indicator, formType: FormType): Behavior[] {
  return formType === 'FIRST' ? indicator.behaviors.filter((b) => b.level >= 3 && b.level <= 7) : indicator.behaviors;
}
