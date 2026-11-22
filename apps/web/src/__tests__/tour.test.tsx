// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { AppUser, Role } from '@kompas/domain';
import { TourOverlay, stepsForUser } from '../components/Tour';

Element.prototype.scrollIntoView = () => undefined;
afterEach(cleanup);

const user = (roles: Role[]): AppUser => ({ uid: 'u', displayName: 'Jan Testowy', email: 'x@y.pl', roles, officeId: 'o' }) as AppUser;
const targets = (roles: Role[]) => stepsForUser(user(roles)).map((s) => s.target ?? '·');

describe('Onboarding tour — steps per role', () => {
  it('supervisor: evaluations, new evaluation, reminders, assistant, replay', () => {
    expect(targets(['SUPERVISOR'])).toEqual(['·', 'evals-active', 'evals-start', 'nav-reminders', 'nav-assistant', 'tour-replay']);
  });
  it('department head: approvals and the assistant', () => {
    expect(targets(['DEPARTMENT_HEAD'])).toEqual(['·', 'approvals-waiting', 'approvals-all', 'nav-assistant', 'tour-replay']);
  });
  it('HR: tiles, process table, reminders — no evaluation contents', () => {
    expect(targets(['HR_ADMIN'])).toEqual(['·', 'hr-tiles', 'hr-table', 'hr-reminders', 'tour-replay']);
  });
  it('supervisor + head: one welcome, one assistant step, approvals added', () => {
    expect(targets(['SUPERVISOR', 'DEPARTMENT_HEAD'])).toEqual(['·', 'evals-active', 'evals-start', 'nav-reminders', 'nav-assistant', 'approvals-waiting', 'approvals-all', 'tour-replay']);
  });
});

describe('Onboarding tour — navigation and skipping', () => {
  const steps = [
    { title: 'Pierwszy', body: 'a' },
    { title: 'Drugi', body: 'b' },
  ];

  it('goes forward and back, finishes on the last step', async () => {
    const done = vi.fn();
    render(<TourOverlay steps={steps} onFinish={done} />);
    expect(screen.getByRole('dialog', { name: 'Pierwszy' })).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Zaczynamy' })));
    expect(screen.getByRole('dialog', { name: 'Drugi' })).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Wstecz' })));
    expect(screen.getByRole('dialog', { name: 'Pierwszy' })).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Zaczynamy' })));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Zakończ' })));
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('marks the page while it runs, so sections skip their scroll reveal under the spotlight', async () => {
    const r = render(<TourOverlay steps={steps} onFinish={() => undefined} />);
    expect(document.documentElement.dataset.tourActive).toBe('true');
    r.unmount();
    expect(document.documentElement.dataset.tourActive).toBeUndefined();
  });

  it('can be skipped with the button or Escape at any step', async () => {
    const done = vi.fn();
    render(<TourOverlay steps={steps} onFinish={done} />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Pomiń samouczek' })));
    expect(done).toHaveBeenCalledTimes(1);
    await act(async () => fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' }));
    expect(done).toHaveBeenCalledTimes(2);
  });
});

// --- provider: the tour shows once per account (remembered in localStorage)
const session = vi.hoisted(() => ({ value: { user: null as AppUser | null, loading: false } }));
vi.mock('../app/session', () => ({
  useSession: () => session.value,
  homePath: () => '/oceny',
}));

describe('Onboarding tour — once per account', () => {
  const page = async (extra?: ReactNode) => {
    const { MemoryRouter } = await import('react-router-dom');
    const { TourProvider } = await import('../components/Tour');
    return (
      <MemoryRouter initialEntries={['/oceny']}>
        <TourProvider>{extra}</TourProvider>
      </MemoryRouter>
    );
  };
  const supervisorPage = (
    <>
      <div data-tour="evals-active" />
      <a data-tour="nav-reminders" />
      <a data-tour="nav-assistant" />
      <button data-tour="tour-replay" />
    </>
  );

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('opens on the first visit, and not again once skipped', async () => {
    session.value = { user: user(['HR_ADMIN']), loading: false };
    const r = render(await page());
    await act(async () => vi.advanceTimersByTime(4000));
    expect(screen.getByRole('dialog', { name: /Dzień dobry, Jan/ })).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Pomiń samouczek' })));
    expect(localStorage.getItem('kompas.tour.v1.u')).toBe('done');
    r.unmount();

    // next sign-in of the same account
    render(await page());
    await act(async () => vi.advanceTimersByTime(4000));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('each account has its own flag', async () => {
    localStorage.setItem('kompas.tour.v1.someone-else', 'done');
    session.value = { user: user(['HR_ADMIN']), loading: false };
    render(await page());
    await act(async () => vi.advanceTimersByTime(4000));
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('skips a step whose element is not on the page, without waiting for it', async () => {
    session.value = { user: user(['SUPERVISOR']), loading: false };
    render(await page(supervisorPage));
    await act(async () => vi.advanceTimersByTime(400));
    // 6 supervisor steps minus „Rozpoczęcie nowej oceny” (its section is missing from this test page)
    expect(screen.getByText('1 / 5')).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Zaczynamy' })));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Dalej' })));
    expect(screen.getByRole('dialog', { name: 'Przypomnienia' })).toBeTruthy();
  });
});
