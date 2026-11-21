import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { AppUser, Role } from '@kompas/domain';
import { auth, usingEmulator } from '../firebase';
import { getUser } from '../data/repo';

/*
 * Session: roles and office come from custom claims (the same values the rules check);
 * the `users` document is used for display only.
 */

interface Session {
  user: AppUser | null;
  loading: boolean;
  error: string | null;
  has: (r: Role) => boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<Session | null>(null);

export class AuthError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

const CREDENTIAL_CODES = ['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email', 'auth/invalid-login-credentials'];

export const isCredentialError = (e: unknown) => CREDENTIAL_CODES.includes((e as { code?: string })?.code ?? '');

/** User-facing message for Firebase Auth errors (and our own Error thrown in `load`). */
export function authErrorMessage(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  if (CREDENTIAL_CODES.includes(code)) return 'Nieprawidłowy e-mail lub hasło.';
  switch (code) {
    case 'auth/network-request-failed':
      return usingEmulator
        ? 'Brak połączenia z usługą logowania. Sprawdź, czy działają emulatory Firebase (npm run emulators).'
        : 'Brak połączenia z usługą logowania. Sprawdź połączenie z internetem.';
    case 'auth/too-many-requests':
      return 'Zbyt wiele prób logowania. Odczekaj chwilę i spróbuj ponownie.';
    case 'auth/user-disabled':
      return 'Konto jest zablokowane. Skontaktuj się z administratorem.';
    case 'auth/user-token-expired':
    case 'auth/requires-recent-login':
      return 'Sesja wygasła. Zaloguj się ponownie.';
  }
  if (!code && e instanceof Error && e.message) return e.message;
  return `Nie udało się zalogować (${code || 'nieznany błąd'}).`;
}

async function load(fb: User): Promise<AppUser> {
  const token = await fb.getIdTokenResult(true);
  const roles = (token.claims.roles as Role[] | undefined) ?? [];
  const officeId = token.claims.officeId as string | undefined;
  if (!officeId || !roles.length) throw new Error('Konto nie ma przypisanego urzędu ani ról. Skontaktuj się z administratorem.');
  // the profile is display-only — a missing / unreadable document must not block the login
  const profile = await getUser(fb.uid).catch(() => null);
  return {
    uid: fb.uid,
    officeId,
    roles,
    email: fb.email ?? '',
    displayName: profile?.displayName ?? fb.displayName ?? fb.email ?? '',
    department: profile?.department ?? '',
    unit: profile?.unit ?? '',
    position: profile?.position ?? '',
  };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () =>
      onAuthStateChanged(auth, async (fb) => {
        // the error is kept on sign-out so the login page can still show why the session ended
        if (!fb) {
          setUser(null);
          setLoading(false);
          return;
        }
        setError(null);
        setLoading(true);
        try {
          setUser(await load(fb));
        } catch (e) {
          setError(authErrorMessage(e));
          setUser(null);
          // don't keep a Firebase session the app cannot use — otherwise every retry ends the same way
          await signOut(auth).catch(() => undefined);
        } finally {
          setLoading(false);
        }
      }),
    [],
  );

  const value: Session = {
    user,
    loading,
    error,
    has: (r) => !!user?.roles.includes(r),
    // Does not toggle `loading`: that would unmount the login page together with its error message.
    // After success onAuthStateChanged takes over (loading → profile → redirect).
    signIn: async (email, password) => {
      setError(null);
      try {
        await signInWithEmailAndPassword(auth, email, password);
      } catch (e) {
        throw new AuthError(authErrorMessage(e), (e as { code?: string }).code ?? '');
      }
    },
    signOut: () => signOut(auth),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const s = useContext(Ctx);
  if (!s) throw new Error('SessionProvider missing');
  return s;
}

export function homePath(u: AppUser) {
  if (u.roles.includes('SUPERVISOR')) return '/oceny';
  if (u.roles.includes('DEPARTMENT_HEAD')) return '/zatwierdzenia';
  return '/hr';
}
