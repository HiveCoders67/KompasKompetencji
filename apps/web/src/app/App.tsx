import * as Tooltip from '@radix-ui/react-tooltip';
import { useEffect, useState, type ReactNode } from 'react';
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { ROLE_LABELS, type Reminder } from '@kompas/domain';
import { watchMyReminders } from '../data/repo';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Spinner } from '../components/ui';
import { AssistantPage } from '../pages/AssistantPage';
import { EvaluationPage } from '../pages/EvaluationPage';
import { HeadApprovals } from '../pages/HeadApprovals';
import { HrPanel } from '../pages/HrPanel';
import { LoginPage } from '../pages/LoginPage';
import { RemindersPage } from '../pages/RemindersPage';
import { SupervisorDashboard } from '../pages/SupervisorDashboard';
import { homePath, SessionProvider, useSession } from './session';
import { ThemeSwitch } from '../components/ThemeSwitch';

function Sidebar() {
  const { user, has, signOut } = useSession();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  useEffect(() => (user && has('SUPERVISOR') ? watchMyReminders(user, setReminders) : undefined), [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps
  const unread = reminders.filter((r) => r.status === 'SENT').length;
  if (!user) return null;
  const item = (to: string, label: string, extra?: ReactNode) => (
    <NavLink to={to} className="nav-pill" end={to === '/oceny'}>
      <span className="flex-1">{label}</span>
      {extra}
    </NavLink>
  );
  return (
    <aside className="sticky top-0 flex h-screen w-[264px] shrink-0 flex-col gap-s5 border-r border-line bg-surface p-s4">
      <Link to={homePath(user)} className="brand-link px-2 pt-2" aria-label="Kompas Kompetencji — strona główna">
        <p className="font-heading text-[22px] leading-tight tracking-[-0.017em]">Kompas Kompetencji</p>
        <p className="hint">Ocena w służbie cywilnej</p>
      </Link>
      <nav aria-label="Nawigacja główna" className="flex flex-col gap-1">
        {has('SUPERVISOR') && item('/oceny', 'Moje oceny')}
        {has('SUPERVISOR') &&
          item(
            '/przypomnienia',
            'Przypomnienia',
            unread > 0 && (
              <span className="badge" aria-label={`${unread} nieprzeczytane`}>
                {unread}
              </span>
            ),
          )}
        {has('DEPARTMENT_HEAD') && item('/zatwierdzenia', 'Zatwierdzenia')}
        {has('HR_ADMIN') && item('/hr', 'Panel HR')}
        {!has('HR_ADMIN') && item('/asystent', 'Asystent formalny')}
      </nav>
      <div className="mt-auto flex flex-col gap-s3 border-t border-line px-2 pt-s4">
        <div className="flex items-center justify-between gap-s2">
          <div className="min-w-0">
            <p className="text-sm font-semibold">{user.displayName}</p>
            <p className="hint text-xs">{user.roles.map((r) => ROLE_LABELS[r]).join(' · ')}</p>
          </div>
          <ThemeSwitch />
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => signOut()}>
          Wyloguj
        </button>
      </div>
    </aside>
  );
}

function Guard({ children, role }: { children: ReactNode; role?: 'SUPERVISOR' | 'DEPARTMENT_HEAD' | 'HR_ADMIN' }) {
  const { user, loading, has } = useSession();
  const loc = useLocation();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  if (role && !has(role)) return <Navigate to={homePath(user)} replace />;
  return <>{children}</>;
}

function Shell() {
  const { user, loading } = useSession();
  const loc = useLocation();
  if (loc.pathname === '/login' || (!user && !loading)) {
    return (
      <Routes>
        <Route path="*" element={user ? <Navigate to={homePath(user)} replace /> : <LoginPage />} />
      </Routes>
    );
  }
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="min-w-0 flex-1 px-[32px] py-s6">
        <div key={loc.pathname} className="mx-auto max-w-[1120px] animate-[sf-fade_var(--sf-duration)_var(--sf-ease)]">
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<Guard>{user ? <Navigate to={homePath(user)} replace /> : null}</Guard>} />
              <Route path="/oceny" element={<Guard role="SUPERVISOR"><SupervisorDashboard /></Guard>} />
              <Route path="/oceny/:id" element={<Guard><EvaluationPage /></Guard>} />
              <Route path="/zatwierdzenia" element={<Guard role="DEPARTMENT_HEAD"><HeadApprovals /></Guard>} />
              <Route path="/przypomnienia" element={<Guard role="SUPERVISOR"><RemindersPage /></Guard>} />
              <Route path="/hr" element={<Guard role="HR_ADMIN"><HrPanel /></Guard>} />
              <Route path="/asystent" element={<Guard><AssistantPage /></Guard>} />
              <Route path="*" element={<Guard>{user ? <Navigate to={homePath(user)} replace /> : null}</Guard>} />
            </Routes>
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
}

export function App() {
  return (
    <SessionProvider>
      <Tooltip.Provider>
        <BrowserRouter>
          <Shell />
        </BrowserRouter>
      </Tooltip.Provider>
    </SessionProvider>
  );
}
