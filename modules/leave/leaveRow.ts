import { businessDaysBetween, formatLeaveBoundary, formatLeaveRange } from "@/lib/leaveDates";
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
  requesterUserId: string | null;
  requesterInitials: string | null;
  requesterAvatarColor: string | null;
  /** HR bookkeeping only -- has this LOA been keyed into each external system. */
  inArbor: boolean;
  inITrent: boolean;
};

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
  requester?: { id: string; fullName: string | null } | null;
  inArbor?: boolean;
  inITrent?: boolean;
}): LeaveRow {
  const start = new Date(r.startDate);
  const end = new Date(r.endDate);
  const name = r.requester?.fullName ?? null;
  return {
    id: r.id,
    startDate: formatLeaveBoundary(start, "short"),
    endDate: formatLeaveBoundary(end, "short"),
    dateRangeLine: formatLeaveRange(start, end, new Date().getUTCFullYear()),
    days: businessDaysBetween(start, end),
    status: loaStatusUiBucket(r.status),
    statusRaw: r.status,
    reasonLabel: r.reason?.label ?? null,
    requesterName: name,
    requesterUserId: r.requester?.id ?? null,
    requesterInitials: name ? initials(name) : null,
    requesterAvatarColor: name ? avatarColor(name) : null,
    inArbor: Boolean(r.inArbor),
    inITrent: Boolean(r.inITrent),
  };
}
