// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { DEMO_EMPLOYEES, buildNewEvaluation, recalc, type Evaluation } from '@kompas/domain';
import { StepAssessment } from '../pages/steps/StepAssessment';
import { AiTextField } from '../components/AiTextField';

const employee = DEMO_EMPLOYEES[0];
const start = (): Evaluation => ({
  ...buildNewEvaluation({ id: 'x', employee, supervisor: { uid: 'sup_dc', displayName: 'M Z' }, now: '2026-11-21T08:00:00.000Z' }),
  status: 'INITIAL_TALK_DONE',
});

let latest: Evaluation;
function Harness() {
  const [ev, setEv] = useState(start);
  latest = ev;
  return (
    <StepAssessment
      ev={ev}
      employee={employee}
      update={(fn) => setEv((e) => recalc(fn(e)))}
      setEmployee={() => undefined}
      readOnly={false}
      isSupervisor
      goTo={() => undefined}
      next={() => undefined}
      flush={async () => undefined}
    />
  );
}

afterEach(cleanup);

describe('Assessment step — human in the loop', () => {
  it('behaviour levels produce a suggestion; the final score stays the supervisor’s choice', async () => {
    render(<Harness />);
    // first criterion (Wykorzystywanie wiedzy, 3 indicators) is expanded
    const groups = screen.getAllByRole('radiogroup', { name: /Zaobserwowane zachowanie/ });
    expect(groups).toHaveLength(3);
    // levels 5 and 7 on two indicators, third „brak podstaw” → mean 6.00 → tie goes down → 5
    await act(async () => fireEvent.click(within(groups[0]).getAllByRole('radio')[2]));
    await act(async () => fireEvent.click(within(groups[1]).getAllByRole('radio')[3]));
    expect(latest.criteriaAssessments[0]).toMatchObject({ suggestedMean: 6, suggestedScore: 5, finalScore: null });
    expect(screen.getAllByText(/Średnia wskaźników 6,00 → sugestia 5 pkt/).length).toBeGreaterThan(0);

    // supervisor deliberately picks 7 — allowed, no justification required
    const scores = screen.getByRole('radiogroup', { name: /Ocena cząstkowa: Wykorzystywanie wiedzy/ });
    await act(async () => fireEvent.click(within(scores).getByRole('radio', { name: '7' })));
    expect(latest.criteriaAssessments[0].finalScore).toBe(7);
    expect(screen.getByText(/inna niż sugestia systemu/)).toBeTruthy();
  });

  it('level 1 on path B shows the negative-result warning', async () => {
    render(<Harness />);
    const g = screen.getAllByRole('radiogroup', { name: /Zaobserwowane zachowanie/ })[0];
    await act(async () => fireEvent.click(within(g).getAllByRole('radio')[0]));
    expect(screen.getByText(/Ocena cząstkowa 1 pkt oznacza ocenę negatywną/)).toBeTruthy();
  });

  it('the last selected indicator cannot be deselected (min. 1 per criterion)', async () => {
    render(<Harness />);
    const boxes = screen.getAllByRole('checkbox', { name: /Dobierz wskaźnik/ });
    await act(async () => fireEvent.click(boxes[0]));
    await act(async () => fireEvent.click(boxes[1]));
    expect(latest.criteriaAssessments[0].indicatorAssessments.filter((i) => i.selected)).toHaveLength(1);
    expect((boxes[2] as HTMLButtonElement).disabled).toBe(true);
  });

  it('„Brak podstaw do oceny” is a real option of the group: checked by default, unchecked by a behaviour, re-checkable', async () => {
    render(<Harness />);
    const g = screen.getAllByRole('radiogroup', { name: /Zaobserwowane zachowanie/ })[0];
    const none = within(g).getByRole('radio', { name: /Brak podstaw do oceny/ });
    expect(none.getAttribute('aria-checked')).toBe('true');
    await act(async () => fireEvent.click(within(g).getAllByRole('radio')[2]));
    expect(none.getAttribute('aria-checked')).toBe('false');
    expect(latest.criteriaAssessments[0].indicatorAssessments[0].level).toBe(5);
    await act(async () => fireEvent.click(none));
    expect(none.getAttribute('aria-checked')).toBe('true');
    expect(latest.criteriaAssessments[0].indicatorAssessments[0].level).toBeNull();
  });
});

describe('AI draft label', () => {
  it('is shown for an inserted draft and the field reports manual edits', () => {
    let edited: string | null = null;
    render(<AiTextField id="j" label="Uzasadnienie" value="Szkic" aiDraft disabled={false} onChange={(v) => (edited = v)} />);
    expect(screen.getByText('Szkic wygenerowany przez AI — wymaga weryfikacji')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Uzasadnienie'), { target: { value: 'Moja wersja' } });
    expect(edited).toBe('Moja wersja');
  });
});
