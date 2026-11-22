// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DateInput, DateRangeInput, parseInput } from '../components/DateInput';
import { FieldPopup } from '../components/ui';

afterEach(cleanup);

const type = (input: HTMLElement, text: string) => {
  fireEvent.change(input, { target: { value: text } });
  fireEvent.blur(input);
};

describe('parseInput', () => {
  it('accepts Polish and ISO formats, rejects impossible dates', () => {
    expect(parseInput('05.11.2026')).toBe('2026-11-05');
    expect(parseInput('5.11.2026')).toBe('2026-11-05');
    expect(parseInput('2026-11-05')).toBe('2026-11-05');
    expect(parseInput('')).toBeNull();
    expect(parseInput('31.02.2026')).toBe('invalid');
    expect(parseInput('jutro')).toBe('invalid');
  });
});

describe('DateInput calendar — days outside min/max are greyed out and cannot be picked', () => {
  it('marks unavailable days and ignores clicks on them', () => {
    const onChange = vi.fn();
    render(<DateInput value="2026-11-10" onChange={onChange} min="2026-11-05" max="2026-11-20" label="data" />);
    fireEvent.click(screen.getByRole('button', { name: 'Otwórz kalendarz — data' }));
    const day4 = screen.getByRole('button', { name: '4 listopada 2026 — niedostępny' });
    const day21 = screen.getByRole('button', { name: '21 listopada 2026 — niedostępny' });
    expect(day4.getAttribute('aria-disabled')).toBe('true');
    expect(day21.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(day4);
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '12 listopada 2026' }));
    expect(onChange).toHaveBeenCalledWith('2026-11-12');
  });

  it('an unreadable typed value restores the previous one', () => {
    const onChange = vi.fn();
    render(<DateInput value="2026-11-10" onChange={onChange} label="data" />);
    const input = screen.getByLabelText('data') as HTMLInputElement;
    type(input, '99.99.2026');
    expect(onChange).not.toHaveBeenCalled();
    expect(input.value).toBe('10.11.2026');
  });
});

describe('DateRangeInput — the end can never be earlier than the start', () => {
  const setup = (from: string | null, to: string | null) => {
    const onChange = vi.fn();
    render(<DateRangeInput from={from} to={to} onChange={onChange} min="2026-10-03" max="2027-01-01" labelFrom="od" labelTo="do" />);
    return { onChange, from: screen.getByLabelText('od'), to: screen.getByLabelText('do') };
  };

  it('in the end picker, days before the start are greyed out', () => {
    setup('2026-10-10', '2026-10-20');
    fireEvent.click(screen.getByRole('button', { name: 'Otwórz kalendarz — do' }));
    expect(screen.getByRole('button', { name: '9 października 2026 — niedostępny' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '10 października 2026' }).getAttribute('aria-disabled')).toBeNull();
  });

  it('a typed end before the start snaps to the start', () => {
    const { onChange, to } = setup('2026-10-10', '2026-10-20');
    type(to, '01.10.2026');
    expect(onChange).toHaveBeenLastCalledWith({ from: '2026-10-10', to: '2026-10-10' });
  });

  it('moving the start past the end moves the end with it', () => {
    const { onChange, from } = setup('2026-10-10', '2026-10-20');
    type(from, '05.11.2026');
    expect(onChange).toHaveBeenLastCalledWith({ from: '2026-11-05', to: '2026-11-05' });
  });
});

describe('FieldPopup', () => {
  it('is an alert when any message blocks, a status for warnings only', () => {
    const err = render(<FieldPopup issues={[{ message: 'Błąd' }, { message: 'Uwaga', severity: 'warning' }]} />);
    expect(err.getByRole('alert').className).toContain('field-popup-error');
    err.unmount();
    const warn = render(<FieldPopup issues={[{ message: 'Uwaga', severity: 'warning' }]} />);
    expect(warn.getByRole('status').className).toContain('field-popup-warning');
  });
});

describe('Calendar note', () => {
  it('states the available range and the reason in one short line', () => {
    render(<DateInput value="2026-11-20" onChange={() => undefined} min="2026-11-16" max="2026-11-22" label="data" reason="Od zatrudnienia do dziś" />);
    fireEvent.click(screen.getByRole('button', { name: 'Otwórz kalendarz — data' }));
    expect(screen.getByText(/Dostępne: 16\.11\.2026 – 22\.11\.2026/)).toBeTruthy();
    expect(screen.getByText('Od zatrudnienia do dziś')).toBeTruthy();
  });
});
