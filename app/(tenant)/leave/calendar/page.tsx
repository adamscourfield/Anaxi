import Link from "next/link";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { canManageLoa, loaManageableRequesterIds } from "@/lib/loa";
import { isApprovedStatus, isDeniedStatus, isPendingStatus } from "@/lib/leaveStatus";
import { prisma } from "@/lib/prisma";
import { StatCard } from "@/components/ui/stat-card";
import { LeaveCalendarGrid } from "../LeaveCalendarGrid";
import { fetchLeaveCalendarMonthRequests } from "@/modules/leave/leaveCalendarMonthData";
import { loaPendingApprovalWhere, loaRequestVisibilityWhere } from "@/modules/leave/leaveQuery";

export default async function LeaveCalendarPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "LEAVE");
  const isApprover = await canManageLoa(user);
  const manageableIds = await loaManageableRequesterIds(user);

  const monthParam = String(searchParams?.month || "");
  let calendarDate = new Date();
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split("-").map(Number);
    calendarDate = new Date(y, m - 1, 1);
  }
  const monthQuery = `${calendarDate.getFullYear()}-${String(calendarDate.getMonth() + 1).padStart(2, "0")}`;

  const requests = await prisma.lOARequest.findMany({
    where: loaRequestVisibilityWhere(user.tenantId, user.id, manageableIds),
    include: { reason: true, requester: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const pendingForApprover = isApprover
    ? await prisma.lOARequest.count({
        where: loaPendingApprovalWhere(user.tenantId, user.id, manageableIds),
      })
    : requests.filter((r) => isPendingStatus(r.status)).length;

  const approvedThisMonth = requests.filter(
    (r) =>
      isApprovedStatus(r.status) &&
      new Date(r.updatedAt) >= monthStart &&
      new Date(r.updatedAt) <= monthEnd,
  ).length;

  const deniedThisMonth = requests.filter(
    (r) =>
      isDeniedStatus(r.status) &&
      new Date(r.updatedAt) >= monthStart &&
      new Date(r.updatedAt) <= monthEnd,
  ).length;

  const resolved = requests.filter((r) => !isPendingStatus(r.status));
  const avgDays =
    resolved.length > 0
      ? resolved.reduce((sum, r) => {
          const diff = new Date(r.updatedAt).getTime() - new Date(r.createdAt).getTime();
          return sum + diff / (1000 * 60 * 60 * 24);
        }, 0) / resolved.length
      : null;
  const avgResponseStr = avgDays !== null ? `${avgDays.toFixed(1)}d` : "—";

  const calendarRequests = await fetchLeaveCalendarMonthRequests({
    tenantId: user.tenantId,
    viewer: user,
    monthKey: monthQuery,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-[1.5rem] font-semibold tracking-tight text-text">Leave of Absence</h1>
        <div className="flex flex-wrap items-center gap-3">
          <div
            className="inline-flex items-center gap-0.5 rounded-lg bg-[var(--surface-container-high)] p-1"
            role="group"
            aria-label="Leave view"
          >
            <Link
              href="/leave?view=list"
              className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-[0.8125rem] font-medium text-muted calm-transition hover:text-text"
            >
              List view
            </Link>
            <Link
              href={`/leave/calendar?month=${monthQuery}`}
              className="inline-flex items-center gap-2 rounded-xl bg-surface-container-lowest px-3.5 py-2 text-[0.8125rem] font-medium text-text calm-transition anx-card-elevated"
            >
              Calendar
            </Link>
          </div>
          <Link
            href="/leave/request"
            className="inline-flex items-center gap-2 rounded-md bg-gradient-to-br from-[var(--primary)] to-[var(--primary-container)] px-5 py-2.5 text-sm font-semibold text-on-primary shadow-none calm-transition hover:opacity-95 active:scale-[0.98]"
          >
            Request Leave
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Total pending"
          value={String(pendingForApprover).padStart(2, "0")}
          tone="glass"
          contextVariant="inline"
          context={
            pendingForApprover > 0 ? (
              <span className="font-semibold text-error">Needs review</span>
            ) : (
              <span className="font-medium text-muted">Queue clear</span>
            )
          }
        />
        <StatCard
          label="Approved (month)"
          value={String(approvedThisMonth).padStart(2, "0")}
          tone="glass"
          contextVariant="inline"
          context={<span className="font-medium text-muted">This month</span>}
        />
        <StatCard
          label="Denied (month)"
          value={String(deniedThisMonth).padStart(2, "0")}
          tone="glass"
          contextVariant="inline"
          context={<span className="font-medium text-muted">This month</span>}
        />
        <StatCard
          label="Average response"
          value={avgResponseStr}
          tone="glass"
          contextVariant="inline"
          context={
            <span
              className={`font-medium ${avgDays !== null && avgDays > 5 ? "font-semibold text-warning" : "text-muted"}`}
            >
              {avgDays !== null && avgDays > 5 ? "Above target" : "Median turnaround"}
            </span>
          }
        />
      </div>

      <LeaveCalendarGrid
        initialMonthKey={monthQuery}
        initialRequests={calendarRequests}
        basePath="calendar"
      />

      <div className="flex flex-wrap gap-3">
        <Link
          href="/leave?view=list"
          className="rounded-lg border border-border/60 bg-surface-container-lowest/70 px-3.5 py-2 text-sm font-medium text-muted backdrop-blur-sm calm-transition hover:border-accent/30 hover:text-accent"
        >
          ← List view
        </Link>
        {isApprover && (
          <Link
            href="/leave#pending-requests"
            className="rounded-lg border border-border/60 bg-surface-container-lowest/70 px-3.5 py-2 text-sm font-medium text-muted backdrop-blur-sm calm-transition hover:border-accent/30 hover:text-accent"
          >
            Pending approvals
          </Link>
        )}
      </div>
    </div>
  );
}
