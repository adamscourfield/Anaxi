/** Schools run on UK time; servers usually run on UTC. "Today" must mean the school's day. */
export const SCHOOL_TIME_ZONE = "Europe/London";

function zoneOffsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const wallAsUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return wallAsUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** Midnight at the start of `now`'s day in the given time zone (default: UK). */
export function startOfDayInZone(now: Date, timeZone: string = SCHOOL_TIME_ZONE): Date {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const midnightWallAsUtc = Date.UTC(get("year"), get("month") - 1, get("day"));
  // Use the offset in force at midnight itself (not now), so clock-change days are right too.
  let guess = new Date(midnightWallAsUtc - zoneOffsetMs(now, timeZone));
  guess = new Date(midnightWallAsUtc - zoneOffsetMs(guess, timeZone));
  return guess;
}
