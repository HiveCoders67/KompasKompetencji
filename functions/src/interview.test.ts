import { DEMO_EMPLOYEES, buildDemoEvaluations } from '@kompas/domain';
import { describe, expect, it } from 'vitest';
import type { LlmProvider } from './llm';
import { evaluationMaterial, suggestAdditionalCriteria } from './interview';

const reply = (text: string): LlmProvider => ({ name: 'fake', generate: async () => text });

describe('OSP criteria suggestion', () => {
  it('keeps only catalogue codes, never mandatory ones, max 3, no duplicates', async () => {
    const llm = reply(
      JSON.stringify({
        criteria: [
          { code: 'SYTUACJE_KRYZYSOWE', reason: 'Dyżury i reagowanie na incydenty (zad. 1).' },
          { code: 'RZETELNOSC', reason: 'obowiązkowe' },
          { code: 'WYMYSLONE', reason: 'x' },
          { code: 'SYTUACJE_KRYZYSOWE', reason: 'dup' },
          { code: 'MYSLENIE_ANALITYCZNE', reason: 'Analiza ryzyka (zad. 3).' },
          { code: 'NEGOCJOWANIE', reason: 'Fora międzynarodowe (zad. 2).' },
          { code: 'PODEJMOWANIE_DECYZJI', reason: 'czwarte' },
        ],
      }),
    );
    const s = await suggestAdditionalCriteria(llm, DEMO_EMPLOYEES[0].osp, 'FORM_C');
    expect(s.map((x) => x.code)).toEqual(['SYTUACJE_KRYZYSOWE', 'MYSLENIE_ANALITYCZNE', 'NEGOCJOWANIE']);
  });
});

describe('Interview Assistant material', () => {
  it('agenda material has OSP, indicators and notes but no scores', () => {
    const ev = buildDemoEvaluations()[1];
    const emp = DEMO_EMPLOYEES.find((e) => e.id === ev.employeeId)!;
    const m = evaluationMaterial(ev, emp, false);
    expect(m).toContain('Zadania (OSP)');
    expect(m).toContain('notatka przełożonego: Opinia o projekcie ustawy');
    expect(m).not.toMatch(/ocena cząstkowa wybrana/);
    expect(evaluationMaterial(ev, emp, true)).toMatch(/ocena cząstkowa wybrana przez przełożonego: 7/);
  });
});
