import Link from "next/link";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { canManageLoa } from "@/lib/loa";
import { prisma } from "@/lib/prisma";
import { StatCard } from "@/components/ui/stat-card";
import { LeaveCalendarGrid } from "../LeaveCalendarGrid";

export default async function LeaveCalendarPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "LEAVE");
  const manager = await canManageLoa(user);

  const monthParam = String(searchParams?.month || "");
  let calendarDate = new Date();
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split("-").map(Number);
    calendarDate = new Date(y, m - 1, 1);
  }
  const monthQuery = `${calendarDate.getFullYear()}-${String(calendarDate.getMonth() + 1).padStart(2, "0")}`;

  const requests = await (prisma as any).lOARequest.findMany({
    where: manager
      ? { tenantId: user.tenantId }
      : { tenantId: user.tenantId, requesterId: user.id },
    include: { reason: true, requester: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const totalPending = (requests as any[]).filter((r) => r.status === "PENDING").length;

  const approvedThisMonth = (requests as any[]).filter(
    (r) =>
      r.status === "APPROVED" &&
      new Date(r.updatedAt) >= monthStart &&
      new Date(r.updatedAt) <= monthEnd,
  ).length;

  const deniedThisMonth = (requests as any[]).filter(
    (r) =>
      r.status === "DENIED" &&
      new Date(r.updatedAt) >= monthStart &&
      new Date(r.updatedAt) <= monthEnd,
  ).length;

  const resolved = (requests as any[]).filter(
    (r) => r.status !== "PENDING" && r.updatedAt && r.createdAt,
  );
  const avgDays =
    resolved.length > 0
      ? resolved.reduce((sum, r) => {
          const diff = new Date(r.updatedAt).getTime() - new Date(r.createdAt).getTime();
          return sum + diff / (1000 * 60 * 60 * 24);
        }, 0) / resolved.length
      : null;
  const avgResponseStr = avgDays !== null ? `${avgDays.toFixed(1)}d` : "—";

  const calStart = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1);
  const calEnd = new Date(
    calendarDate.getFullYear(),
    calendarDate.getMonth() + 1,
    0,
    23,
    59,
    59,
  );
  const calendarRequests = (requests as any[]).filter((r) => {
    const rStart = new Date(r.startDate);
    const rEnd = new Date(r.endDate);
    return rStart <= calEnd && rEnd >= calStart;
  });

  const prevMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1);
  const nextMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1);
  const prevMonthParam = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`;
  const nextMonthParam = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-[1.5rem] font-semibold tracking-tight text-text">Leave of Absence</h1>
        <div className="flex flex-wrap items-center gap-3">
          <div
            className="inline-flex items-center gap-0.5 rounded-[14px] bg-[var(--surface-container-high)] p-1"
            role="group"
            aria-label="Leave view"
          >
            <Link
              href="/leave?view=list"
              className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-[0.8125rem] font-medium text-muted calm-transition hover:text-text"
            >
              <svg
                className="h-3.5 w-3.5 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"
                  strokeLinecap="round"
                />
              </svg>
              List view
            </Link>
            <Link
              href={`/leave/calendar?month=${monthQuery}`}
              className="inline-flex items-center gap-2 rounded-xl bg-surface-container-lowest px-3.5 py-2 text-[0.8125rem] font-medium text-text calm-transition anx-card-elevated"
            >
              <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="none">
                <rect
                  x="3.5"
                  y="4.5"
                  width="13"
                  height="12"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="M6.5 2.8v3.4M13.5 2.8v3.4M3.5 8.2h13"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              Calendar
            </Link>
          </div>

          <Link
            href="/leave/request"
            className="inline-flex items-center gap-2 rounded-md bg-gradient-to-br from-[var(--primary)] to-[var(--primary-container)] px-5 py-2.5 text-sm font-semibold text-on-primary shadow-[var(--shadow-btn)] calm-transition hover:opacity-95 hover:shadow-[var(--shadow-btn-hover)] motion-safe:hover:-translate-y-px active:scale-[0.98]"
          >
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Request Leave
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Total pending"
          value={String(totalPending).padStart(2, "0")}
          tone="glass"
          contextVariant="inline"
          context={
            totalPending > 0 ? (
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
        monthAnchor={calendarDate}
        calendarRequests={calendarRequests}
        prevMonthHref={`/leave/calendar?month=${prevMonthParam}`}
        nextMonthHref={`/leave/calendar?month=${nextMonthParam}`}
        requestHrefForId={(id) => `/leave/${id}?from=calendar&month=${monthQuery}`}
      />

      <div className="flex flex-wrap gap-3">
        <Link
          href="/leave?view=list"
          className="rounded-lg border border-border/60 bg-surface-container-lowest/70 px-3.5 py-2 text-sm font-medium text-muted backdrop-blur-sm calm-transition hover:border-accent/30 hover:text-accent"
        >
          ← List view
        </Link>
        {manager && (
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
