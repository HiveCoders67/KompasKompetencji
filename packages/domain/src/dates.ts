import { addDays, addMonths, differenceInCalendarDays, format, isValid, parse } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import type { DateOnly } from './types';

/*
 * Calendar dates (CLAUDE.md „Daty”). In Firestore a calendar date is a Timestamp at 00:00
 * Europe/Warsaw, created and read ONLY through toDateOnly / fromDateOnly. Deadline logic works on
 * `DateOnly` strings via the helpers below — no direct `new Date()` in deadline code.
 * Month arithmetic follows date-fns (31.01 + 1 month = last day of February).
 */

export const TIME_ZONE = 'Europe/Warsaw';
const FMT = 'yyyy-MM-dd';

/** `DateOnly` → instant at 00:00 Europe/Warsaw (to be stored as a Firestore Timestamp). */
export function toDateOnly(d: DateOnly): Date {
  assertDateOnly(d);
  return fromZonedTime(`${d}T00:00:00`, TIME_ZONE);
}

/** Instant (e.g. Timestamp.toDate()) → calendar date in Europe/Warsaw. */
export function fromDateOnly(instant: Date): DateOnly {
  return formatInTimeZone(instant, TIME_ZONE, FMT);
}

/** Today's calendar date in Europe/Warsaw; `now` injectable for tests. */
export function today(now: Date = new Date()): DateOnly {
  return fromDateOnly(now);
}

export function assertDateOnly(d: string): asserts d is DateOnly {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !isValid(parse(d, FMT, new Date(2000, 0, 1)))) {
    throw new Error(`Nieprawidłowa data: ${d}`);
  }
}

// Arithmetic on a local-midnight Date used only as a calendar carrier (time zone irrelevant).
const carrier = (d: DateOnly): Date => parse(d, FMT, new Date(2000, 0, 1));
const back = (d: Date): DateOnly => format(d, FMT);

export const plusDays = (d: DateOnly, n: number): DateOnly => back(addDays(carrier(d), n));
export const plusMonths = (d: DateOnly, n: number): DateOnly => back(addMonths(carrier(d), n));
export const daysBetween = (from: DateOnly, to: DateOnly): number => differenceInCalendarDays(carrier(to), carrier(from));

/** dd.mm.rrrr as on the official forms. */
export function formatPL(d: DateOnly | null | undefined): string {
  if (!d) return '—';
  return format(carrier(d), 'dd.MM.yyyy');
}

export const maxDate = (a: DateOnly, b: DateOnly): DateOnly => (a > b ? a : b);
export const minDate = (a: DateOnly, b: DateOnly): DateOnly => (a < b ? a : b);
