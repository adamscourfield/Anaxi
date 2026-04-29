import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { canManageLoa } from "@/lib/loa";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { LeaveHistoryTable } from "./LeaveHistoryTable";

function fmtShortRange(start: Date, end: Date) {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const a = start.toLocaleDateString("en-GB", opts);
  if (start.toDateString() === end.toDateString()) return a;
  const sameMonth =
    start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth();
  const b = end.toLocaleDateString("en-GB", sameMonth ? { day: "numeric" } : opts);
  return `${a} — ${b}`;
}

function businessDays(start: Date, end: Date): number {
  let count = 0;
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  const fin = new Date(end);
  fin.setHours(0, 0, 0, 0);
  while (cur <= fin) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
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

export default async function LeaveHistoryPage() {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "LEAVE");
  const manager = await canManageLoa(user);

  const requests = await (prisma as any).lOARequest.findMany({
    where: manager
      ? { tenantId: user.tenantId }
      : { tenantId: user.tenantId, requesterId: user.id },
    include: { reason: true, requester: true },
    orderBy: { updatedAt: "desc" },
    take: 500,
  });

  const rows = (requests as any[]).map((request) => {
    const start = new Date(request.startDate);
    const end = new Date(request.endDate);
    const name = request.requester?.fullName ?? "Staff member";
    const days = businessDays(start, end);
    return {
      id: request.id,
      requesterName: name,
      requesterInitials: initials(name),
      requesterAvatarColor: avatarColor(name),
      requestedDates: fmtShortRange(start, end),
      daysLabel: `${days} working day${days === 1 ? "" : "s"}`,
      reasonLabel: request.reason?.label ?? request.reasonText ?? "—",
      status: request.status as "PENDING" | "APPROVED" | "DENIED",
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader variant="ledger"
        eyebrow="Leave of Absence"
        title="Ledger History"
        subtitle="Browse every leave request and filter by status or keyword."
      />

      <LeaveHistoryTable rows={rows} isManager={manager} />
    </div>
  );
}
