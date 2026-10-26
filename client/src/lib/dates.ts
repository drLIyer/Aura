import { format } from "date-fns";

/**
 * All dates the app sends are the user's own calendar dates (YYYY-MM-DD) and wall-clock times.
 * Never use `new Date("YYYY-MM-DD")` (parsed as UTC) or `toISOString()` for "today" — both shift
 * the day for anyone west or east of Greenwich.
 */

export const toLocalDate = (d: Date) => format(d, "yyyy-MM-dd");
export const todayLocal = () => toLocalDate(new Date());
export const nowLocalTime = () => format(new Date(), "HH:mm");
export const nowLocalDateTime = () => format(new Date(), "yyyy-MM-dd'T'HH:mm");

/** Parses YYYY-MM-DD as local midnight. */
export function parseLocalDate(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function shiftDate(date: string, days: number): string {
  const d = parseLocalDate(date);
  d.setDate(d.getDate() + days);
  return toLocalDate(d);
}

export const formatLongDate = (date: string) => format(parseLocalDate(date), "EEEE, MMMM d, yyyy");
export const formatShortDate = (date: string) => format(parseLocalDate(date), "MMM d");

/** "2026-10-20T14:05" → "Oct 20, 2:05 PM". Local wall-clock strings are parsed as local time. */
export function formatLocalDateTime(value: string): string {
  const d = new Date(value.length === 16 ? `${value}:00` : value);
  return isNaN(d.getTime()) ? value : format(d, "MMM d, h:mm a");
}

export const userTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
