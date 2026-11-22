// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { DEMO_EMPLOYEES, buildNewEvaluation } from '@kompas/domain';
import { AssistantPanel } from '../components/AssistantPanel';

const ev = buildNewEvaluation({ id: 'x', employee: DEMO_EMPLOYEES[0], supervisor: { uid: 'sup_dc', displayName: 'M Z' }, now: '2026-11-21T08:00:00.000Z' });

function Harness() {
  const [open, setOpen] = useState(false);
  return <AssistantPanel open={open} onOpenChange={setOpen} ev={ev} step="assessment" update={() => undefined} readOnly={false} />;
}

// jsdom has no layout — the chats scroll their last message into view
Element.prototype.scrollIntoView = () => undefined;

afterEach(cleanup);

describe('Floating AI assistant', () => {
  it('the corner button opens a window over the page; Escape folds it back and the typed question survives', async () => {
    render(<Harness />);
    const fab = screen.getByRole('button', { name: 'Asystent AI' });
    const win = document.getElementById('assistant-window')!;
    expect(fab.getAttribute('aria-expanded')).toBe('false');
    expect(win.getAttribute('data-open')).toBe('false');

    await act(async () => fireEvent.click(fab));
    expect(fab.getAttribute('aria-expanded')).toBe('true');
    expect(win.getAttribute('data-open')).toBe('true');
    expect(fab.textContent).toContain('Zamknij asystenta');

    const input = screen.getByLabelText('Pytanie do asystenta formalnego') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Ile dni na sprzeciw?' } });
    await act(async () => fireEvent.keyDown(input, { key: 'Escape' }));
    expect(win.getAttribute('data-open')).toBe('false');

    await act(async () => fireEvent.click(fab));
    expect((screen.getByLabelText('Pytanie do asystenta formalnego') as HTMLInputElement).value).toBe('Ile dni na sprzeciw?');
  });
});
