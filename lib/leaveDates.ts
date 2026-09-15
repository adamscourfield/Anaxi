/**
 * Date helpers for leave requests (local calendar days, business-day counts).
 */

/** Parse `YYYY-MM-DD` as local midnight (avoids UTC shift). */
export function parseLocalDateInput(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return new Date(NaN);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return new Date(y, mo - 1, d, 0, 0, 0, 0);
}

/** Parse a `datetime-local` input value (`YYYY-MM-DDTHH:mm`) as local time. Falls back to local midnight if no time is given. */
export function parseLocalDateTimeInput(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!m) return parseLocalDateInput(value);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const h = Number(m[4]);
  const min = Number(m[5]);
  return new Date(y, mo - 1, d, h, min, 0, 0);
}

export function businessDaysBetween(start: Date, end: Date): number {
  let count = 0;
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  const fin = new Date(end);
  fin.setHours(0, 0, 0, 0);
  if (fin < cur) return 0;
  while (cur <= fin) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

/** An end time of exactly local midnight means "through the end of that day" (all-day leave), not that same instant. */
function endOfDayIfMidnight(date: Date): Date {
  if (date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0 && date.getMilliseconds() === 0) {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  }
  return date;
}

/** True when the two [start, end] intervals overlap, down to their exact times. */
export function dateRangesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart <= endOfDayIfMidnight(bEnd) && bStart <= endOfDayIfMidnight(aEnd);
}
