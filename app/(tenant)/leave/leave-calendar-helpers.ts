/** Shared helpers for Leave calendar views (main /leave and /leave/calendar). */

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function stripTime(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function daysSpan(rs: Date, re: Date) {
  const a = stripTime(rs).getTime();
  const b = stripTime(re).getTime();
  return Math.round((b - a) / (86400 * 1000)) + 1;
}

export function monthOverlapRange(rStart: Date, rEnd: Date, calStart: Date, calEnd: Date) {
  const rs = stripTime(rStart);
  const re = stripTime(rEnd);
  const cs = stripTime(calStart);
  const ce = stripTime(calEnd);
  const os = rs > cs ? rs : cs;
  const oe = re < ce ? re : ce;
  if (os > oe) return null;
  return { os, oe };
}

export function localDayKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function calendarTitleForRequest(request: any, day: Date, totalSpanDays: number) {
  const reason = request.reason?.label ?? "Leave";
  if (request.status === "DENIED" || totalSpanDays <= 1) return reason;
  if (stripTime(day).getTime() === stripTime(new Date(request.startDate)).getTime()) {
    return `${reason} (Starts)`;
  }
  return reason;
}

export function continuationLabel(request: any) {
  const name = request.requester?.fullName?.trim() || "Staff";
  const parts = name.split(/\s+/);
  const short = parts.length > 1 ? parts[parts.length - 1]! : parts[0]!;
  const reason = request.reason?.label ?? "Leave";
  const word = reason.split(/\s+/)[0] ?? reason;
  return `${short} ${word} continued`;
}
