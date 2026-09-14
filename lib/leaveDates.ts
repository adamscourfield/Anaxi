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

export function dateRangesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  const as = new Date(aStart);
  as.setHours(0, 0, 0, 0);
  const ae = new Date(aEnd);
  ae.setHours(0, 0, 0, 0);
  const bs = new Date(bStart);
  bs.setHours(0, 0, 0, 0);
  const be = new Date(bEnd);
  be.setHours(0, 0, 0, 0);
  return as <= be && bs <= ae;
}
