import { describe, expect, it } from 'vitest';
import { authErrorMessage, isCredentialError } from '../app/session';
import { callableError } from '../data/repo';

const fnErr = (code: string, message: string) => Object.assign(new Error(message), { code: `functions/${code}` });

describe('callableError', () => {
  it('quota → exact message from docs/03 § 1', () => {
    expect(callableError(fnErr('resource-exhausted', 'whatever'))).toBe('Wyczerpano dostępne zasoby asystenta AI. Spróbuj ponownie później.');
  });

  it('shows Polish messages from our HttpsError as is', () => {
    expect(callableError(fnErr('failed-precondition', 'Asystent AI nie jest poprawnie skonfigurowany.'))).toBe('Asystent AI nie jest poprawnie skonfigurowany.');
    expect(callableError(fnErr('unavailable', 'Asystent AI jest chwilowo niedostępny.'))).toBe('Asystent AI jest chwilowo niedostępny.');
  });

  it('replaces SDK-generated code-only messages', () => {
    expect(callableError(fnErr('internal', 'internal'))).toMatch(/błąd serwera/);
    expect(callableError(fnErr('internal', 'INTERNAL'))).toMatch(/błąd serwera/);
    expect(callableError(fnErr('deadline-exceeded', 'deadline-exceeded'))).toMatch(/nie odpowiedział na czas/);
    expect(callableError(fnErr('not-found', 'not-found'))).toMatch(/Cloud Functions/);
    expect(callableError(fnErr('unauthenticated', ''))).toMatch(/Zaloguj się ponownie/);
  });

  it('handles non-Firebase values', () => {
    expect(callableError(undefined)).toMatch(/nieoczekiwany błąd/);
    expect(callableError(new Error('Coś poszło nie tak.'))).toBe('Coś poszło nie tak.');
  });
});

describe('authErrorMessage', () => {
  const authErr = (code: string) => Object.assign(new Error(`Firebase: Error (${code}).`), { code });

  it('maps credential errors to one message and flags them', () => {
    for (const code of ['auth/invalid-credential', 'auth/user-not-found', 'auth/wrong-password']) {
      expect(authErrorMessage(authErr(code))).toBe('Nieprawidłowy e-mail lub hasło.');
      expect(isCredentialError(authErr(code))).toBe(true);
    }
  });

  it('explains network and throttling errors', () => {
    expect(authErrorMessage(authErr('auth/network-request-failed'))).toMatch(/Brak połączenia z usługą logowania/);
    expect(authErrorMessage(authErr('auth/too-many-requests'))).toMatch(/Zbyt wiele prób/);
    expect(isCredentialError(authErr('auth/network-request-failed'))).toBe(false);
  });

  it('keeps our own messages (e.g. missing claims) and names unknown codes', () => {
    expect(authErrorMessage(new Error('Konto nie ma przypisanego urzędu ani ról.'))).toBe('Konto nie ma przypisanego urzędu ani ról.');
    expect(authErrorMessage(authErr('auth/internal-error'))).toBe('Nie udało się zalogować (auth/internal-error).');
  });
});
