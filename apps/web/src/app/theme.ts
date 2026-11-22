import { useEffect, useSyncExternalStore } from 'react';

/*
 * Theme follows prefers-color-scheme; a manual choice is stored and applied as [data-theme] (STYLE_GUIDE § 1).
 * One shared store, so every switch (sidebar, login page) shows and changes the same value.
 */
export type Theme = 'light' | 'dark';
const KEY = 'kompas-theme';

const system = (): Theme => (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
const stored = (): Theme | null => {
  try {
    const t = localStorage.getItem(KEY);
    return t === 'light' || t === 'dark' ? t : null;
  } catch {
    return null;
  }
};

let current: Theme = stored() ?? system();
const listeners = new Set<() => void>();

export function setTheme(next: Theme) {
  current = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* private mode — the choice just is not remembered */
  }
  document.documentElement.dataset.theme = next;
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, () => current);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return { theme, setTheme, toggle: () => setTheme(current === 'dark' ? 'light' : 'dark') };
}
