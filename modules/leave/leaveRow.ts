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
};

function fmt(date: Date) {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function fmtShortRange(start: Date, end: Date) {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const a = start.toLocaleDateString("en-GB", opts);
  if (start.toDateString() === end.toDateString()) return a;
  const sameMonth =
    start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth();
  const b = end.toLocaleDateString("en-GB", sameMonth ? { day: "numeric" } : opts);
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
  };
}
