import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { canManageLoa } from "@/lib/loa";
import { prisma } from "@/lib/prisma";
import { LeaveTable, type LeaveRow } from "./LeaveTable";
import { LeaveCalendarGrid } from "./LeaveCalendarGrid";
import { LeaveCreatedToast } from "@/components/leave/leave-created-toast";
import { Button } from "@/components/ui/button";
import { fetchLeaveCalendarMonthRequests } from "@/modules/leave/leaveCalendarMonthData";

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

  const monthQuery = `${calendarDate.getFullYear()}-${String(calendarDate.getMonth() + 1).padStart(2, "0")}`;

  /* Calendar data */
  const calendarRequests = await fetchLeaveCalendarMonthRequests({
    tenantId: user.tenantId,
    viewerUserId: user.id,
    manager,
    monthKey: monthQuery,
  });

  const isCalendar = view === "calendar";

  return (
    <div className="space-y-8">
      <Suspense fallback={null}>
        <LeaveCreatedToast />
      </Suspense>
      <PageHeader variant="ledger"
        title="Leave of Absence"
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

            <Button asChild className="rounded-md px-5 shadow-md">
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

      {isCalendar ? (
        <LeaveCalendarGrid
          initialMonthKey={monthQuery}
          initialRequests={calendarRequests}
          basePath="leave"
        />
      ) : !hasAnyListRows ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-background py-16">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-md bg-surface-container-low">
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
