import type { ISODate, ISODateTime } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date of a Date or timestamp. */
export function toISODate(d: Date | ISODateTime): ISODate {
  const date = typeof d === 'string' ? new Date(d) : d;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Parses YYYY-MM-DD as local midnight (Date's own parser treats it as UTC). */
export function parseISODate(date: ISODate): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date: ISODate, days: number): ISODate {
  const d = parseISODate(date);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** Whole days from a to b (b − a). */
export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 86_400_000);
}

/** Inclusive list of dates from start to end. */
export function dateRange(start: ISODate, end: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

export function hoursBetween(a: ISODateTime, b: ISODateTime): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 3_600_000;
}

/** Value for an <input type="datetime-local">. */
export function toLocalDateTimeInput(d: Date): string {
  return `${toISODate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDateTime(ts: ISODateTime): string {
  return new Date(ts).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatDate(date: ISODate): string {
  return parseISODate(date).toLocaleDateString(undefined, { dateStyle: 'medium' });
}
