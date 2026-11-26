/**
 * Date helpers for leave requests.
 *
 * Convention: a leave start or end is the wall-clock date and time the person
 * typed ("2 Dec, 09:00"), with no time zone. It is stored as that same clock
 * reading in UTC. Every request already in the database was written this way
 * (the app server runs in UTC), so all parsing, counting and formatting here
 * uses UTC on purpose. Formatting in Europe/London instead would shift every
 * summer request by an hour and make all-day leave read "1:00 am".
 *
 * Never format a leave date with a bare toLocale…() call: use the helpers below,
 * which are safe on the server and in the browser whatever the machine's zone.
 */

const UTC = "UTC";

/** Parse `YYYY-MM-DD` as an all-day value (00:00 on that date). */
export function parseLocalDateInput(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return new Date(NaN);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

/** Parse a `datetime-local` value (`YYYY-MM-DDTHH:mm`). Falls back to an all-day date when no time is given. */
export function parseLocalDateTimeInput(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!m) return parseLocalDateInput(value);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])));
}

/** A value at exactly 00:00 is an all-day boundary, not a time. */
export function leaveHasTimeOfDay(date: Date | string): boolean {
  const d = new Date(date);
  return d.getUTCHours() !== 0 || d.getUTCMinutes() !== 0;
}

/** "2026-12-02" for the calendar day of a leave boundary. */
export function leaveDayKey(date: Date | string): string {
  return new Date(date).toISOString().slice(0, 10);
}

export function businessDaysBetween(start: Date, end: Date): number {
  const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const fin = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  if (fin < cur) return 0;
  let count = 0;
  while (cur <= fin) {
    const dow = cur.getUTCDay();
    if (dow !== 0 && dow !== 6) count++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count;
}

/** An end at exactly 00:00 means "through the end of that day" (all-day leave), not that instant. */
export function leaveEffectiveEnd(date: Date): Date {
  if (!leaveHasTimeOfDay(date) && date.getUTCSeconds() === 0 && date.getUTCMilliseconds() === 0) {
    const d = new Date(date);
    d.setUTCHours(23, 59, 59, 999);
    return d;
  }
  return date;
}

/** True when the two [start, end] intervals overlap, down to their exact times. */
export function dateRangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart <= leaveEffectiveEnd(bEnd) && bStart <= leaveEffectiveEnd(aEnd);
}

function time(date: Date): string {
  return date
    .toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: UTC })
    .replace(":00", "")
    .replace(" ", "");
}

/** "2 December 2026" or "2 December 2026, 9am". */
export function formatLeaveBoundary(value: Date | string, month: "long" | "short" = "long"): string {
  const date = new Date(value);
  const base = date.toLocaleDateString("en-GB", { day: "numeric", month, year: "numeric", timeZone: UTC });
  return leaveHasTimeOfDay(date) ? `${base}, ${time(date)}` : base;
}

/**
 * Compact range for lists: "2 – 4 Dec", "29 Nov – 4 Dec", "2 Dec", "2 Dec, 9am – 1pm",
 * "2 Dec, 9am – 4 Dec, 1pm". Adds the year only when it isn't `currentYear`.
 */
export function formatLeaveRange(startValue: Date | string, endValue: Date | string, currentYear?: number): string {
  const start = new Date(startValue);
  const end = new Date(endValue);
  const showYear = currentYear !== undefined && (start.getUTCFullYear() !== currentYear || end.getUTCFullYear() !== currentYear);
  const day = (d: Date, withMonth = true, withYear = showYear) =>
    d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: withMonth ? "short" : undefined,
      year: withYear ? "numeric" : undefined,
      timeZone: UTC,
    });
  const sameDay = leaveDayKey(start) === leaveDayKey(end);
  const timed = leaveHasTimeOfDay(start) || leaveHasTimeOfDay(end);

  if (sameDay) {
    if (!timed) return day(start);
    return `${day(start)}, ${time(start)} – ${time(end)}`;
  }
  if (timed) {
    const s = leaveHasTimeOfDay(start) ? `${day(start)}, ${time(start)}` : day(start);
    const e = leaveHasTimeOfDay(end) ? `${day(end)}, ${time(end)}` : day(end);
    return `${s} – ${e}`;
  }
  const sameMonth = start.getUTCFullYear() === end.getUTCFullYear() && start.getUTCMonth() === end.getUTCMonth();
  return sameMonth ? `${day(start, false, false)} – ${day(end)}` : `${day(start, true, showYear && start.getUTCFullYear() !== end.getUTCFullYear())} – ${day(end)}`;
}
