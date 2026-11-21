import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { AppUser, Role } from '@kompas/domain';
import { auth } from '../firebase';
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
        setError(null);
        if (!fb) {
          setUser(null);
          setLoading(false);
          return;
        }
        try {
          setUser(await load(fb));
        } catch (e) {
          setError((e as Error).message);
          setUser(null);
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
    signIn: async (email, password) => {
      setLoading(true);
      try {
        await signInWithEmailAndPassword(auth, email, password);
      } catch (e) {
        setLoading(false);
        const code = (e as { code?: string }).code ?? '';
        throw new Error(code.includes('invalid-credential') || code.includes('wrong-password') ? 'Nieprawidłowy e-mail lub hasło.' : 'Nie udało się zalogować.');
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
