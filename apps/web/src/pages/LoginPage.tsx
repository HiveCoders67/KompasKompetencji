import { useState, type FormEvent } from 'react';
import { DEMO_PASSWORD, DEMO_USERS, JURY_ENTRY } from '@kompas/domain';
import { useSession } from '../app/session';
import { Alert, Field } from '../components/ui';
import { callableError, resetDemoFn } from '../data/repo';
import { usingEmulator } from '../firebase';

export function LoginPage() {
  const { signIn, error: sessionError, loading } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resetState, setResetState] = useState<'idle' | 'busy' | 'done'>('idle');

  const enter = async (uid: string) => {
    setError(null);
    const u = DEMO_USERS.find((x) => x.uid === uid)!;
    try {
      await signIn(u.email, DEMO_PASSWORD);
    } catch (e) {
      setError((e as Error).message + ' Jeśli dane demo nie zostały jeszcze wczytane, użyj „Przywróć dane demo”.');
    }
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await signIn(email, password);
    } catch (err) {
      setError((err as Error).message);
    }
  };
  const reset = async () => {
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

  return (
    <main className="mx-auto grid min-h-screen max-w-[1120px] grid-cols-[1.1fr_1fr] items-center gap-s7 px-[32px] py-s7">
      <section>
        <p className="badge badge-outline mb-s4">HackNation 2026 · Ministerstwo Cyfryzacji</p>
        <h1>Kompas Kompetencji</h1>
        <p className="mt-s4 max-w-[520px] text-lg text-muted">
          Krok po kroku przez pierwszą ocenę i ocenę okresową w służbie cywilnej — z modelem kompetencji MC, terminami ustawowymi i asystentem AI
          opartym na przepisach.
        </p>
        <ul className="hint mt-s5 flex flex-col gap-1">
          <li>Sugestia poziomu wylicza się ze wskaźników — ocenę zawsze wybiera przełożony.</li>
          <li>Asystent formalny odpowiada wyłącznie na podstawie ustawy, rozporządzeń i poradników KPRM, z cytatem źródła.</li>
          <li>Dane w prototypie są fikcyjne.</li>
        </ul>
      </section>

      <section className="card flex flex-col gap-s5">
        <div>
          <h4>Wejście dla jury</h4>
          <p className="hint mt-1">Konta demo z prawdziwymi rolami (custom claims).</p>
        </div>
        <div className="flex flex-col gap-s2">
          {JURY_ENTRY.map((j, i) => (
            <button key={j.uid} className={`btn ${i === 0 ? '' : 'btn-secondary'} justify-between text-left`} disabled={loading} onClick={() => enter(j.uid)}>
              <span>{j.label}</span>
              <span className="text-xs font-normal opacity-80">{j.description}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-s3">
          <button className="btn btn-ghost btn-sm" onClick={reset} disabled={resetState === 'busy'}>
            {resetState === 'busy' ? 'Przywracanie…' : 'Przywróć dane demo'}
          </button>
          {resetState === 'done' && <span className="text-sm text-success">Dane demo przywrócone.</span>}
        </div>
        {(error || sessionError) && <Alert tone="error">{error ?? sessionError}</Alert>}

        <details className="border-t border-line pt-s4">
          <summary className="cursor-pointer text-sm font-semibold">Logowanie e-mailem i hasłem</summary>
          <form onSubmit={submit} className="mt-s4 flex flex-col gap-s3">
            <Field label="E-mail" htmlFor="email">
              <input id="email" className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Field>
            <Field label="Hasło" htmlFor="password">
              <input id="password" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </Field>
            <button className="btn btn-secondary self-start" type="submit" disabled={loading}>
              Zaloguj
            </button>
          </form>
        </details>
        {usingEmulator && <p className="hint text-xs">Tryb emulatora Firebase.</p>}
      </section>
    </main>
  );
}
