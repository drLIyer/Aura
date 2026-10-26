/**
 * The server runs in UTC but users don't. These helpers turn an instant into the user's own
 * calendar date and clock time, so "today" and "lunch at 15:10" mean what the user means.
 */

export function isValidTimeZone(tz: string | undefined | null): tz is string {
  if (!tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function parts(instant: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const p = Object.fromEntries(fmt.formatToParts(instant).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/** YYYY-MM-DD in the given time zone. */
export function localDate(instant: Date, timeZone: string): string {
  return parts(instant, timeZone).date;
}

/** HH:MM in the given time zone. */
export function localTime(instant: Date, timeZone: string): string {
  return parts(instant, timeZone).time;
}

/** YYYY-MM-DDTHH:MM in the given time zone (a "floating" local timestamp). */
export function localDateTime(instant: Date, timeZone: string): string {
  const p = parts(instant, timeZone);
  return `${p.date}T${p.time}`;
}
