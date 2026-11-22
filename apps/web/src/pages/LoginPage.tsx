import { useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { DEMO_PASSWORD, DEMO_USERS, JURY_ENTRY } from '@kompas/domain';
import { isCredentialError, useSession } from '../app/session';
import { ThemeSwitch } from '../components/ThemeSwitch';
import { Alert, Field, Modal } from '../components/ui';
import { callableError, resetDemoFn } from '../data/repo';
import { usingEmulator } from '../firebase';

type Mode = 'choose' | 'jury' | 'email';

/** „Wejdź jako przełożony” → „Przełożony”; „Marta Zielińska — opis…” → „Marta Zielińska”. */
const roleName = (label: string) => {
  const r = label.replace(/^Wejdź jako\s+/i, '');
  return r.charAt(0).toUpperCase() + r.slice(1);
};
const personName = (description: string) => description.split(' — ')[0];

export function LoginPage() {
  const { signIn, error: sessionError, loading } = useSession();
  const [mode, setMode] = useState<Mode>('choose');
  // panel we came back from — its button gets the focus again (keyboard users stay in place)
  const [lastPanel, setLastPanel] = useState<Mode | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resetState, setResetState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [confirmReset, setConfirmReset] = useState(false);
  const [signingIn, setSigningIn] = useState<string | null>(null);
  const busy = loading || signingIn !== null || resetState === 'busy';

  const go = (next: Mode) => {
    setError(null);
    setResetState('idle');
    setLastPanel(mode);
    setMode(next);
  };

  const attempt = async (key: string, email: string, password: string, demo: boolean) => {
    setError(null);
    setResetState((s) => (s === 'done' ? 'idle' : s));
    setSigningIn(key);
    try {
      await signIn(email, password);
    } catch (e) {
      const hint = demo && isCredentialError(e) ? ' Konta demo mogły nie zostać jeszcze wczytane — użyj „Przywróć dane demo”.' : '';
      setError((e as Error).message + hint);
    } finally {
      setSigningIn(null);
    }
  };
  const enter = (uid: string) => {
    const u = DEMO_USERS.find((x) => x.uid === uid)!;
    return attempt(uid, u.email, DEMO_PASSWORD, true);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    return attempt('form', email, password, false);
  };
  const reset = async () => {
    setConfirmReset(false);
    setResetState('busy');
    setError(null);
    try {
      await resetDemoFn({});
      setResetState('done');
    } catch (e) {
      setResetState('idle');
      setError(callableError(e));
    }
  };

  const shownError = error ?? sessionError;

  return (
    <main className="relative mx-auto grid min-h-screen max-w-[1040px] grid-cols-[1.1fr_1fr] items-center gap-s7 px-[32px] py-s7">
      <ThemeSwitch className="absolute right-[32px] top-s5" />
      <section>
        <p className="badge badge-outline mb-s4">HackNation 2026 · Ministerstwo Cyfryzacji</p>
        <h1>
          Kompas Kompetencji<span className="brand-dot" aria-hidden="true">.</span>
        </h1>
        <p className="mt-s4 max-w-[440px] text-lg text-muted">Krok po kroku przez pierwszą ocenę i ocenę okresową w służbie cywilnej.</p>
        <p className="hint mt-s5">Prototyp · dane fikcyjne</p>
      </section>

      <section className="card">
        <AutoHeight>
          {/* key = mode → the panel re-mounts and plays its enter animation */}
          <div key={mode} className="login-panel flex flex-col gap-s4" data-dir={mode === 'choose' ? 'back' : 'forward'}>
            {mode === 'choose' && (
              <>
                <h4>Zaloguj się</h4>
                <div className="flex flex-col gap-s2">
                  <button className="btn justify-between" onClick={() => go('jury')} autoFocus={lastPanel === 'jury'}>
                    Wejście dla jury
                    <Arrow />
                  </button>
                  <button className="btn btn-secondary justify-between" onClick={() => go('email')} autoFocus={lastPanel === 'email'}>
                    E-mail i hasło
                    <Arrow />
                  </button>
                </div>
              </>
            )}

            {mode === 'jury' && (
              <>
                <PanelHeader title="Wejście dla jury" onBack={() => go('choose')} disabled={busy} />
                <div className="flex flex-col gap-s2">
                  {JURY_ENTRY.map((j, i) => (
                    <button
                      key={j.uid}
                      className={`btn ${i === 0 ? '' : 'btn-secondary'} justify-between`}
                      disabled={busy}
                      aria-busy={signingIn === j.uid}
                      onClick={() => enter(j.uid)}
                      autoFocus={i === 0}
                    >
                      <span>{signingIn === j.uid ? 'Logowanie…' : roleName(j.label)}</span>
                      <span className="text-xs font-normal opacity-80">{personName(j.description)}</span>
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-s3">
                  <button className="btn btn-ghost btn-sm" onClick={() => setConfirmReset(true)} disabled={busy}>
                    {resetState === 'busy' ? 'Przywracanie…' : 'Przywróć dane demo'}
                  </button>
                  {resetState === 'done' && <span className="text-sm text-success">Przywrócono.</span>}
                </div>
              </>
            )}

            {mode === 'email' && (
              <>
                <PanelHeader title="E-mail i hasło" onBack={() => go('choose')} disabled={busy} />
                <form onSubmit={submit} className="flex flex-col gap-s3">
                  <Field label="E-mail" htmlFor="email" required>
                    <input id="email" className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
                  </Field>
                  <Field label="Hasło" htmlFor="password" required>
                    <input id="password" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                  </Field>
                  <button className="btn self-start" type="submit" disabled={busy}>
                    {signingIn === 'form' ? 'Logowanie…' : 'Zaloguj'}
                  </button>
                </form>
              </>
            )}

            {shownError && <Alert tone="error">{shownError}</Alert>}
            {usingEmulator && <p className="hint text-xs">Tryb emulatora Firebase.</p>}
          </div>
        </AutoHeight>
      </section>
      <Modal
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Przywrócić dane demo?"
        description="Wszystkie oceny, przypomnienia i zmiany zostaną usunięte i zastąpione danymi startowymi."
      >
        <div className="flex justify-end gap-2">
          {/* „Anuluj” first → it gets the initial focus, so Enter does not wipe the data by accident */}
          <button className="btn btn-ghost" onClick={() => setConfirmReset(false)}>
            Anuluj
          </button>
          <button className="btn btn-danger" onClick={reset}>
            Przywróć dane demo
          </button>
        </div>
      </Modal>
    </main>
  );
}

function PanelHeader({ title, onBack, disabled }: { title: string; onBack: () => void; disabled: boolean }) {
  return (
    <div className="flex items-center gap-s2">
      <button className="btn btn-ghost btn-sm !px-2" onClick={onBack} disabled={disabled} aria-label="Wróć do wyboru logowania">
        <Arrow back />
      </button>
      <h4>{title}</h4>
    </div>
  );
}

function Arrow({ back }: { back?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={back ? 'M10 3.5L5.5 8l4.5 4.5' : 'M6 3.5L10.5 8 6 12.5'} />
    </svg>
  );
}

/** Animates its own height to the content's height (the card grows / shrinks smoothly when the panel changes). */
function AutoHeight({ children }: { children: ReactNode }) {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);
  useLayoutEffect(() => {
    const el = inner.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div className="auto-height" style={{ height }}>
      <div ref={inner} className="auto-height-inner">
        {children}
      </div>
    </div>
  );
}
