import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { today as todayWarsaw, type DateOnly } from '@kompas/domain';

/*
 * Calendar date input with our own picker (native pickers differ per browser — e.g. Firefox does not grey out days
 * outside min/max). Values are DateOnly strings (YYYY-MM-DD); calendar arithmetic below is display-only, on UTC
 * day numbers — deadline logic stays in @kompas/domain.
 */

const MONTHS = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];
const MONTHS_GEN = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
const WEEKDAYS = ['pon.', 'wt.', 'śr.', 'czw.', 'pt.', 'sob.', 'niedz.'];

const pad = (n: number) => String(n).padStart(2, '0');
const toIso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}` as DateOnly;
const parts = (d: DateOnly) => ({ y: Number(d.slice(0, 4)), m: Number(d.slice(5, 7)) - 1, d: Number(d.slice(8, 10)) });
const dayNo = (d: DateOnly) => {
  const p = parts(d);
  return Date.UTC(p.y, p.m, p.d) / 86_400_000;
};
const fromDayNo = (n: number): DateOnly => {
  const t = new Date(n * 86_400_000);
  return toIso(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
};
const addDaysIso = (d: DateOnly, n: number) => fromDayNo(dayNo(d) + n);
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
const addMonthsIso = (d: DateOnly, n: number) => {
  const p = parts(d);
  const y = p.y + Math.floor((p.m + n) / 12);
  const m = (((p.m + n) % 12) + 12) % 12;
  return toIso(y, m, Math.min(p.d, daysInMonth(y, m)));
};
/** Monday = 0 … Sunday = 6 */
const weekday = (d: DateOnly) => (new Date(dayNo(d) * 86_400_000).getUTCDay() + 6) % 7;

export const formatInput = (d: DateOnly | null) => (d ? `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}` : '');

/** Accepts „dd.mm.rrrr”, „d.m.rrrr”, „dd-mm-rrrr”, „dd/mm/rrrr” and ISO „rrrr-mm-dd”. */
export function parseInput(text: string): DateOnly | null | 'invalid' {
  const t = text.trim();
  if (!t) return null;
  let y: number, m: number, d: number;
  const pl = t.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/);
  const iso = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (pl) [d, m, y] = [Number(pl[1]), Number(pl[2]), Number(pl[3])];
  else if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else return 'invalid';
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m - 1)) return 'invalid';
  return toIso(y, m - 1, d);
}

const inRange = (d: DateOnly, min?: DateOnly | null, max?: DateOnly | null) => (!min || d >= min) && (!max || d <= max);

export function DateInput({
  id,
  value,
  onChange,
  disabled,
  min,
  max,
  invalid,
  describedBy,
  label,
  reason,
}: {
  id?: string;
  value: DateOnly | null;
  onChange: (d: DateOnly | null) => void;
  disabled?: boolean;
  /** Days outside [min, max] are greyed out and cannot be picked. */
  min?: DateOnly | null;
  max?: DateOnly | null;
  /** 'error' / 'warning' highlights the field (its message is shown in the field popup). */
  invalid?: 'error' | 'warning' | false;
  describedBy?: string;
  /** Accessible name when there is no <label for> (e.g. the ends of a range). */
  label?: string;
  /** Short reason for the available range, shown in the calendar (e.g. „od zatrudnienia do dziś”). */
  reason?: string;
}) {
  const [text, setText] = useState(formatInput(value));
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const dialogId = useId();

  useEffect(() => setText(formatInput(value)), [value]);

  // close on outside click
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const commitText = () => {
    const parsed = parseInput(text);
    if (parsed === 'invalid') setText(formatInput(value)); // unreadable → keep the previous value
    else if (parsed !== value) onChange(parsed);
  };

  return (
    <div ref={root} className="relative max-w-[220px]">
      <div className="date-field" data-disabled={disabled || undefined}>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          placeholder="dd.mm.rrrr"
          className="input mono date-field-input"
          value={text}
          disabled={disabled}
          aria-label={label}
          aria-invalid={invalid === 'error' || undefined}
          data-warning={invalid === 'warning' || undefined}
          aria-describedby={describedBy}
          onChange={(e) => setText(e.target.value)}
          onBlur={commitText}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitText();
            if (e.key === 'ArrowDown' && e.altKey) setOpen(true);
          }}
        />
        <button
          ref={toggle}
          type="button"
          className="date-field-toggle"
          aria-label={`Otwórz kalendarz${label ? ` — ${label}` : ''}`}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? dialogId : undefined}
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <rect x="2" y="3" width="12" height="11" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
            <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {open && (
        <Calendar
          id={dialogId}
          value={value}
          min={min}
          max={max}
          reason={reason}
          onSelect={(d) => {
            onChange(d);
            setOpen(false);
            toggle.current?.focus();
          }}
          onClose={() => {
            setOpen(false);
            toggle.current?.focus();
          }}
        />
      )}
    </div>
  );
}

function Calendar({
  id,
  value,
  min,
  max,
  onSelect,
  onClose,
  reason,
}: {
  id: string;
  value: DateOnly | null;
  min?: DateOnly | null;
  max?: DateOnly | null;
  onSelect: (d: DateOnly | null) => void;
  onClose: () => void;
  reason?: string;
}) {
  const today = todayWarsaw();
  const clamp = (d: DateOnly) => (min && d < min ? min : max && d > max ? max : d);
  const [focused, setFocused] = useState<DateOnly>(clamp(value ?? today));
  const grid = useRef<HTMLDivElement>(null);
  const { y, m } = parts(focused);
  const first = toIso(y, m, 1);
  const last = toIso(y, m, daysInMonth(y, m));
  const lead = weekday(first);
  const cells: (DateOnly | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth(y, m) }, (_, i) => toIso(y, m, i + 1))];
  while (cells.length % 7) cells.push(null);
  const canPrev = !min || addDaysIso(first, -1) >= min;
  const canNext = !max || addDaysIso(last, 1) <= max;

  // keep keyboard focus on the focused day
  useEffect(() => {
    grid.current?.querySelector<HTMLButtonElement>(`[data-day="${focused}"]`)?.focus();
  }, [focused]);

  const move = (to: DateOnly) => setFocused(clamp(to));
  const onKey = (e: KeyboardEvent) => {
    const keys: Record<string, () => void> = {
      ArrowLeft: () => move(addDaysIso(focused, -1)),
      ArrowRight: () => move(addDaysIso(focused, 1)),
      ArrowUp: () => move(addDaysIso(focused, -7)),
      ArrowDown: () => move(addDaysIso(focused, 7)),
      PageUp: () => move(addMonthsIso(focused, -1)),
      PageDown: () => move(addMonthsIso(focused, 1)),
      Home: () => move(addDaysIso(focused, -weekday(focused))),
      End: () => move(addDaysIso(focused, 6 - weekday(focused))),
      Escape: onClose,
    };
    if (keys[e.key]) {
      e.preventDefault();
      keys[e.key]();
    }
  };

  return (
    <div id={id} className="datepicker" role="dialog" aria-modal="false" aria-label="Wybierz datę" onKeyDown={onKey}>
      <div className="datepicker-head">
        <button type="button" className="datepicker-nav" onClick={() => move(addMonthsIso(focused, -1))} disabled={!canPrev} aria-label="Poprzedni miesiąc">
          ‹
        </button>
        <p className="datepicker-title" aria-live="polite">
          {MONTHS[m]} {y}
        </p>
        <button type="button" className="datepicker-nav" onClick={() => move(addMonthsIso(focused, 1))} disabled={!canNext} aria-label="Następny miesiąc">
          ›
        </button>
      </div>
      <div ref={grid} role="grid" aria-label={`${MONTHS[m]} ${y}`} className="datepicker-grid">
        <div role="row" className="contents">
          {WEEKDAYS.map((w) => (
            <span key={w} role="columnheader" className="datepicker-wd">
              {w}
            </span>
          ))}
        </div>
        {Array.from({ length: cells.length / 7 }, (_, r) => (
          <div role="row" className="contents" key={r}>
            {cells.slice(r * 7, r * 7 + 7).map((d, i) => {
              if (!d) return <span key={`e${r}-${i}`} role="gridcell" />;
              const allowed = inRange(d, min, max);
              const p = parts(d);
              return (
                <span key={d} role="gridcell" aria-selected={d === value}>
                  <button
                    type="button"
                    data-day={d}
                    className="datepicker-day"
                    data-selected={d === value || undefined}
                    data-today={d === today || undefined}
                    aria-disabled={!allowed || undefined}
                    aria-label={`${p.d} ${MONTHS_GEN[p.m]} ${p.y}${allowed ? '' : ' — niedostępny'}`}
                    tabIndex={d === focused ? 0 : -1}
                    onClick={() => allowed && onSelect(d)}
                    onFocus={() => d !== focused && setFocused(d)}
                    onKeyDown={(e) => {
                      if ((e.key === 'Enter' || e.key === ' ') && allowed) {
                        e.preventDefault();
                        onSelect(d);
                      }
                    }}
                  >
                    {p.d}
                  </button>
                </span>
              );
            })}
          </div>
        ))}
      </div>
      {(min || max) && (
        <p className="datepicker-note">
          Dostępne: {min && max ? `${formatInput(min)} – ${formatInput(max)}` : min ? `od ${formatInput(min)}` : `do ${formatInput(max!)}`}
          {reason && <span className="block">{reason}</span>}
        </p>
      )}
      <div className="datepicker-foot">
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => onSelect(null)}>
          Wyczyść
        </button>
        {inRange(today, min, max) && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onSelect(today)}>
            Dziś
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * „od – do” range: the end can never be earlier than the start. The pickers grey out impossible days and a typed
 * value is corrected — moving the start past the end moves the end with it; an end before the start snaps to the start.
 */
export function DateRangeInput({
  idFrom,
  from,
  to,
  onChange,
  disabled,
  min,
  max,
  invalid,
  describedBy,
  labelFrom = 'od',
  labelTo = 'do',
  reason,
}: {
  idFrom?: string;
  from: DateOnly | null;
  to: DateOnly | null;
  onChange: (range: { from: DateOnly | null; to: DateOnly | null }) => void;
  disabled?: boolean;
  /** Legal bounds of the whole range. */
  min?: DateOnly | null;
  max?: DateOnly | null;
  invalid?: 'error' | 'warning' | false;
  describedBy?: string;
  labelFrom?: string;
  labelTo?: string;
  reason?: string;
}) {
  const setFrom = (f: DateOnly | null) => onChange({ from: f, to: f && to && to < f ? f : to });
  const setTo = (t: DateOnly | null) => onChange({ from, to: t && from && t < from ? from : t });
  return (
    <div className="flex items-center gap-2">
      <DateInput
        id={idFrom}
        value={from}
        onChange={setFrom}
        disabled={disabled}
        min={min}
        max={max} // a later start simply moves the end with it
        invalid={invalid}
        describedBy={describedBy}
        label={labelFrom}
        reason={reason}
      />
      <span aria-hidden="true">–</span>
      <DateInput
        value={to}
        onChange={setTo}
        disabled={disabled}
        min={from && min ? (from > min ? from : min) : (from ?? min)}
        max={max}
        invalid={invalid}
        describedBy={describedBy}
        label={labelTo}
        reason={reason ? `${reason}, nie wcześniej niż data początkowa` : 'Nie wcześniej niż data początkowa'}
      />
    </div>
  );
}
