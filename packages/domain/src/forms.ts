import type { CompetencyCode, FormType, Score } from './types';

/** Mandatory criteria — docs/02 § 1.3 (forms B, C; § 4 rozp. 2016) and § 2.2 (first evaluation). */
export const MANDATORY_CRITERIA: Record<FormType, CompetencyCode[]> = {
  FORM_B: ['ZARZADZANIE_LUDZMI', 'PODEJMOWANIE_DECYZJI', 'ORGANIZACJA_PRACY', 'WSPOLPRACA', 'KOMUNIKACJA'],
  FORM_C: ['WYKORZYSTYWANIE_WIEDZY', 'RZETELNOSC', 'ORGANIZACJA_PRACY', 'WSPOLPRACA', 'KOMUNIKACJA'],
  FIRST: ['RZETELNOSC', 'WYKORZYSTYWANIE_WIEDZY', 'ORGANIZACJA_PRACY', 'KOMUNIKACJA', 'WSPOLPRACA'],
};

export const MAX_ADDITIONAL_CRITERIA = 3;

export const SCALE: Record<FormType, Score[]> = {
  FIRST: [3, 5, 7],
  FORM_B: [1, 3, 5, 7, 9],
  FORM_C: [1, 3, 5, 7, 9],
};

export function isScoreAllowed(formType: FormType, score: number): score is Score {
  return (SCALE[formType] as number[]).includes(score);
}

/** 0..3 additional criteria, no duplicates, none of the form's mandatory ones (docs/02 § 1.3). */
export function validateAdditionalCriteria(formType: FormType, additional: CompetencyCode[]): string[] {
  const errors: string[] = [];
  if (formType === 'FIRST' && additional.length > 0) {
    errors.push('Pierwsza ocena ma stały zestaw 5 elementów — kryteria dodatkowe nie są dopuszczalne.');
  }
  if (additional.length > MAX_ADDITIONAL_CRITERIA) {
    errors.push(`Można wybrać maksymalnie ${MAX_ADDITIONAL_CRITERIA} kryteria dodatkowe.`);
  }
  if (new Set(additional).size !== additional.length) errors.push('Kryteria dodatkowe nie mogą się powtarzać.');
  if (additional.some((c) => MANDATORY_CRITERIA[formType].includes(c))) {
    errors.push('Kryterium obowiązkowe dla tego arkusza nie może być wybrane jako dodatkowe.');
  }
  return errors;
}
