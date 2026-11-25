/** Meeting dates and times, always in UK time (servers run on UTC). */
const TZ = "Europe/London";

const dayKey = (d: Date) => d.toLocaleDateString("en-GB", { timeZone: TZ });

export function formatMeetingTime(d: Date | string): string {
  return new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: TZ });
}

/** "Today", "Tomorrow", "Yesterday", "Thu 28 Nov", or "Thu 28 Nov 2025" in another year. */
export function formatMeetingDay(d: Date | string, now = new Date()): string {
  const date = new Date(d);
  const key = dayKey(date);
  if (key === dayKey(now)) return "Today";
  if (key === dayKey(new Date(now.getTime() + 86_400_000))) return "Tomorrow";
  if (key === dayKey(new Date(now.getTime() - 86_400_000))) return "Yesterday";
  const sameYear =
    date.toLocaleDateString("en-GB", { year: "numeric", timeZone: TZ }) === now.toLocaleDateString("en-GB", { year: "numeric", timeZone: TZ });
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
    timeZone: TZ,
  });
}

/** "Thu 28 Nov, 09:00–10:00". */
export function formatMeetingSlot(start: Date | string, end?: Date | string | null, now = new Date()): string {
  return `${formatMeetingDay(start, now)}, ${formatMeetingTime(start)}${end ? `–${formatMeetingTime(end)}` : ""}`;
}

export function minutesBetween(a: Date | string, b: Date | string): number {
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000));
}

export function formatMinutes(mins: number): string {
  if (mins < 1) return "under a minute";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
