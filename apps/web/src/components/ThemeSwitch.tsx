import { useTheme } from '../app/theme';
import { Hint } from './ui';

/**
 * Manual theme toggle (STYLE_GUIDE § 1): an icon-only ghost button — shows the theme it switches to
 * (moon → dark, sun → light). The same control in the sidebar and on the login page.
 */
export function ThemeSwitch({ className = '' }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const label = theme === 'dark' ? 'Włącz jasny motyw' : 'Włącz ciemny motyw';
  return (
    <Hint text={label}>
      <button type="button" className={`btn btn-ghost btn-sm theme-toggle ${className}`} onClick={toggle} aria-label={label}>
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {theme === 'dark' ? (
            <>
              <circle cx="8" cy="8" r="3" />
              <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1" />
            </>
          ) : (
            <path d="M13.5 9.5A5.5 5.5 0 016.5 2.5a5.5 5.5 0 107 7z" />
          )}
        </svg>
      </button>
    </Hint>
  );
}
