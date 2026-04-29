import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { canManageLoa } from "@/lib/loa";
import { prisma } from "@/lib/prisma";
import { StatCard } from "@/components/ui/stat-card";
import { LeaveTable, type LeaveRow } from "./LeaveTable";
import { LeaveCalendarGrid } from "./LeaveCalendarGrid";
import { LeaveCreatedToast } from "@/components/leave/leave-created-toast";
import { Button } from "@/components/ui/button";

/* ── Helpers ────────────────────────────────────────────────────── */

function fmt(date: Date) {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** e.g. Oct 12 — Oct 15 (same year omitted on end when same month/year) */
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

/* ── Page ───────────────────────────────────────────────────────── */

export default async function LeavePage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "LEAVE");
  const manager = await canManageLoa(user);

  const view = String(searchParams?.view || "list");
  const monthParam = String(searchParams?.month || "");

  /* Calendar month */
  let calendarDate = new Date();
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split("-").map(Number);
    calendarDate = new Date(y, m - 1, 1);
  }

  /* Fetch requests */
  const requests = await (prisma as any).lOARequest.findMany({
    where: manager
      ? { tenantId: user.tenantId }
      : { tenantId: user.tenantId, requesterId: user.id },
    include: { reason: true, requester: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  /* Stats */
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

  function mapToLeaveRow(r: any): LeaveRow {
    const start = new Date(r.startDate);
    const end = new Date(r.endDate);
    const name = r.requester?.fullName ?? null;
    return {
      id: r.id,
      startDate: fmt(start),
      endDate: fmt(end),
      dateRangeLine: fmtShortRange(start, end),
      days: businessDays(start, end),
      status: r.status as "PENDING" | "APPROVED" | "DENIED",
      reasonLabel: r.reason?.label ?? null,
      requesterName: name,
      requesterInitials: name ? initials(name) : null,
      requesterAvatarColor: name ? avatarColor(name) : null,
    };
  }

  const pendingRows: LeaveRow[] = (requests as any[])
    .filter((r) => r.status === "PENDING")
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    .slice(0, 50)
    .map(mapToLeaveRow);

  const completedRows: LeaveRow[] = (requests as any[])
    .filter((r) => r.status === "APPROVED" || r.status === "DENIED")
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 50)
    .map(mapToLeaveRow);

  const hasAnyListRows = pendingRows.length > 0 || completedRows.length > 0;

  /* Calendar data */
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

  const isCalendar = view === "calendar";

  return (
    <div className="space-y-8">
      <Suspense fallback={null}>
        <LeaveCreatedToast />
      </Suspense>
      <PageHeader
        title="Leave of Absence"
        titleClassName="text-pretty text-[clamp(1.75rem,4vw,2.25rem)] font-bold leading-[1.1] tracking-[-0.035em] text-text"
        className="border-b border-[color-mix(in_srgb,var(--outline-variant)_22%,transparent)] pb-8"
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <div className="segmented-toggle" role="group" aria-label="Leave view">
              <Link
                href="/leave?view=list"
                className={`segmented-toggle-btn inline-flex items-center gap-2 ${!isCalendar ? "segmented-toggle-btn-active" : ""}`}
              >
                <svg
                  className="h-3.5 w-3.5 shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden
                >
                  <path
                    d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"
                    strokeLinecap="round"
                  />
                </svg>
                List view
              </Link>
              <Link
                href="/leave?view=calendar"
                className={`segmented-toggle-btn inline-flex items-center gap-2 ${isCalendar ? "segmented-toggle-btn-active" : ""}`}
              >
                <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="none" aria-hidden>
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

            <Button asChild className="rounded-full px-5 shadow-md">
              <Link href="/leave/request" className="gap-2">
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  aria-hidden
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Request Leave
              </Link>
            </Button>
          </div>
        }
      />

      {/* Stat cards — KPI row */}
      <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
        <StatCard
          layout="kpi"
          label="Total pending"
          value={String(totalPending).padStart(2, "0")}
          tone="glass"
          showChevron={false}
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="12" cy="12" r="10" />
              <path strokeLinecap="round" d="M12 6v6l4 2" />
            </svg>
          }
          iconTileClassName="bg-[var(--pill-error-bg)] text-[var(--pill-error-text)]"
          valueClassName="mt-1 text-[2rem] font-bold leading-none tracking-[-0.03em] tabular-nums text-text"
          context={
            totalPending > 0 ? (
              <span className="font-semibold text-[var(--error)]">Needs review</span>
            ) : (
              <span className="font-medium text-muted">Queue clear</span>
            )
          }
        />
        <StatCard
          layout="kpi"
          label="Approved (month)"
          value={String(approvedThisMonth).padStart(2, "0")}
          tone="glass"
          showChevron={false}
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M22 11.08V12a10 10 0 11-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          }
          iconTileClassName="bg-[var(--status-approved-light)] text-[var(--status-approved-text)]"
          valueClassName="mt-1 text-[2rem] font-bold leading-none tracking-[-0.03em] tabular-nums text-text"
          context={<span className="font-medium text-muted">This month</span>}
        />
        <StatCard
          layout="kpi"
          label="Denied (month)"
          value={String(deniedThisMonth).padStart(2, "0")}
          tone="glass"
          showChevron={false}
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="12" cy="12" r="10" />
              <path strokeLinecap="round" d="M15 9l-6 6M9 9l6 6" />
            </svg>
          }
          iconTileClassName="bg-[var(--surface-container)] text-muted"
          valueClassName="mt-1 text-[2rem] font-bold leading-none tracking-[-0.03em] tabular-nums text-text"
          context={<span className="font-medium text-muted">This month</span>}
        />
        <StatCard
          layout="kpi"
          label="Average response"
          value={avgResponseStr}
          tone="glass"
          showChevron={false}
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          iconTileClassName="bg-[var(--cat-blue-bg)] text-[var(--cat-blue-text)]"
          valueClassName="mt-1 text-[2rem] font-bold leading-none tracking-[-0.03em] tabular-nums text-text"
          context={
            <span
              className={`font-medium ${avgDays !== null && avgDays > 5 ? "font-semibold text-[var(--warning)]" : "text-muted"}`}
            >
              {avgDays !== null && avgDays > 5 ? "Above target" : "Median turnaround"}
            </span>
          }
        />
      </div>

      {isCalendar ? (
        <LeaveCalendarGrid
          monthAnchor={calendarDate}
          calendarRequests={calendarRequests}
          prevMonthHref={`/leave?view=calendar&month=${prevMonthParam}`}
          nextMonthHref={`/leave?view=calendar&month=${nextMonthParam}`}
          requestHrefForId={(id) => `/leave/${id}`}
        />
      ) : !hasAnyListRows ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface-container-lowest py-16">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-container-low">
            <svg
              className="h-6 w-6 text-muted"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
            </svg>
          </div>
          <p className="text-[0.875rem] font-semibold text-text">No leave requests yet</p>
          <p className="mt-1 text-[0.8125rem] text-muted">
            Submitted requests will appear here with approval status.
          </p>
          <Button asChild className="mt-4 rounded-xl px-4 py-2.5 text-[0.875rem]">
            <Link href="/leave/request">Submit first request</Link>
          </Button>
        </div>
      ) : (
        <LeaveTable pendingRows={pendingRows} completedRows={completedRows} isManager={manager} />
      )}
    </div>
  );
}
