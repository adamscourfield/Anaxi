import { businessDaysBetween } from "@/lib/leaveDates";
import { loaStatusUiBucket, type LoaStatusUiBucket } from "@/lib/leaveStatus";

export type LeaveRow = {
  id: string;
  startDate: string;
  endDate: string;
  dateRangeLine: string;
  days: number;
  status: LoaStatusUiBucket;
  statusRaw: string;
  reasonLabel: string | null;
  requesterName: string | null;
  requesterInitials: string | null;
  requesterAvatarColor: string | null;
  /** HR bookkeeping only -- has this LOA been keyed into each external system. */
  inArbor: boolean;
  inITrent: boolean;
};

/** Requests created before time-of-day support default to local midnight -- don't show a "12:00 am" time for those. */
function hasTimeOfDay(date: Date) {
  return date.getHours() !== 0 || date.getMinutes() !== 0;
}

function fmtTime(date: Date) {
  return date.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true });
}

function fmt(date: Date) {
  const base = date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return hasTimeOfDay(date) ? `${base}, ${fmtTime(date)}` : base;
}

function fmtShortRange(start: Date, end: Date) {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const withTime = (date: Date, label: string) => (hasTimeOfDay(date) ? `${label} ${fmtTime(date)}` : label);
  const a = withTime(start, start.toLocaleDateString("en-GB", opts));
  if (start.toDateString() === end.toDateString() && !hasTimeOfDay(start) && !hasTimeOfDay(end)) return a;
  const sameMonth =
    start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth();
  const b = withTime(end, end.toLocaleDateString("en-GB", sameMonth ? { day: "numeric" } : opts));
  return `${a} — ${b}`;
}

const AVATAR_COLORS = [
  "bg-cat-violet-bg text-cat-violet-text",
  "bg-cat-blue-bg text-cat-blue-text",
  "bg-scale-strong-light text-scale-strong-text",
  "bg-scale-limited-light text-scale-limited-text",
  "bg-scale-some-light text-scale-some-text",
  "bg-cat-indigo-bg text-cat-indigo-text",
];

function avatarColor(name: string) {
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[hash];
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

export function mapLoaRequestToLeaveRow(r: {
  id: string;
  startDate: Date;
  endDate: Date;
  status: string;
  reason?: { label: string } | null;
  requester?: { fullName: string | null } | null;
  inArbor?: boolean;
  inITrent?: boolean;
}): LeaveRow {
  const start = new Date(r.startDate);
  const end = new Date(r.endDate);
  const name = r.requester?.fullName ?? null;
  return {
    id: r.id,
    startDate: fmt(start),
    endDate: fmt(end),
    dateRangeLine: fmtShortRange(start, end),
    days: businessDaysBetween(start, end),
    status: loaStatusUiBucket(r.status),
    statusRaw: r.status,
    reasonLabel: r.reason?.label ?? null,
    requesterName: name,
    requesterInitials: name ? initials(name) : null,
    requesterAvatarColor: name ? avatarColor(name) : null,
    inArbor: Boolean(r.inArbor),
    inITrent: Boolean(r.inITrent),
  };
}
