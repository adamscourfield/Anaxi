/**
 * Due dates for actions are calendar days (stored as midnight UTC on that day).
 * Everything here compares UK calendar days, so "due today" is never "overdue",
 * whatever the time or the server's zone. Safe to import from client components.
 */
const TZ = "Europe/London";

/** "2026-11-25" for the UK calendar day of `d`. */
export function ukDayKey(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-CA", { timeZone: TZ });
}

function keyToUtcDays(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

/** Whole days from today (UK) to the due day: 0 today, 1 tomorrow, -1 yesterday. */
export function daysUntilDue(dueDate: Date | string, now: Date = new Date()): number {
  return keyToUtcDays(ukDayKey(dueDate)) - keyToUtcDays(ukDayKey(now));
}

export function isPastDue(dueDate: Date | string | null | undefined, now: Date = new Date()): boolean {
  if (!dueDate) return false;
  return daysUntilDue(dueDate, now) < 0;
}

export type DueBucket = "overdue" | "today" | "week" | "later" | "none";

export function dueBucket(dueDate: Date | string | null | undefined, now: Date = new Date()): DueBucket {
  if (!dueDate) return "none";
  const days = daysUntilDue(dueDate, now);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days <= 7) return "week";
  return "later";
}

/** "Due today", "Due tomorrow", "Due Fri 28 Nov", "3 days overdue", "Due yesterday". */
export function formatDue(dueDate: Date | string, now: Date = new Date()): string {
  const days = daysUntilDue(dueDate, now);
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days === -1) return "Due yesterday";
  if (days < 0) return `${-days} days overdue`;
  const date = new Date(dueDate);
  const sameYear = ukDayKey(date).slice(0, 4) === ukDayKey(now).slice(0, 4);
  return `Due ${date.toLocaleDateString("en-GB", {
    weekday: days <= 7 ? "short" : undefined,
    day: "numeric",
    month: "short",
    year: sameYear ? undefined : "numeric",
    timeZone: TZ,
  })}`;
}
