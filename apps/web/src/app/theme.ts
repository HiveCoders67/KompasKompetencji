import { useEffect, useState } from 'react';

/** Theme follows prefers-color-scheme; a manual choice is stored and applied as [data-theme] (STYLE_GUIDE § 1). */
export type Theme = 'light' | 'dark';
const KEY = 'kompas-theme';

const system = (): Theme => (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem(KEY) as Theme | null) ?? system());
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return {
    theme,
    toggle: () =>
      setTheme((t) => {
        const next = t === 'dark' ? 'light' : 'dark';
        localStorage.setItem(KEY, next);
        return next;
      }),
  };
}
