import Link from "next/link";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { canManageLoa } from "@/lib/loa";
import { prisma } from "@/lib/prisma";
import { StatCard } from "@/components/ui/stat-card";
import { LeaveTable, type LeaveRow } from "./LeaveTable";

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

function stripTime(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysSpan(rs: Date, re: Date) {
  const a = stripTime(rs).getTime();
  const b = stripTime(re).getTime();
  return Math.round((b - a) / (86400 * 1000)) + 1;
}

function monthOverlapRange(rStart: Date, rEnd: Date, calStart: Date, calEnd: Date) {
  const rs = stripTime(rStart);
  const re = stripTime(rEnd);
  const cs = stripTime(calStart);
  const ce = stripTime(calEnd);
  const os = rs > cs ? rs : cs;
  const oe = re < ce ? re : ce;
  if (os > oe) return null;
  return { os, oe };
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

function localDayKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
  const created = String(searchParams?.created || "") === "1";

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

  const daysInMonth = calEnd.getDate();
  const calDays = Array.from(
    { length: daysInMonth },
    (_, i) => new Date(calStart.getFullYear(), calStart.getMonth(), i + 1),
  );
  const firstDayOfWeek = calStart.getDay(); // 0 = Sunday
  const todayKey = localDayKey(new Date());
  const monthLabel = calStart.toLocaleString("en-GB", { month: "long", year: "numeric" });

  const prevMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1);
  const nextMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1);
  const prevMonthParam = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`;
  const nextMonthParam = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}`;

  const isCalendar = view === "calendar";

  function calendarTitleForRequest(request: any, day: Date, totalSpanDays: number) {
    const reason = request.reason?.label ?? "Leave";
    if (request.status === "DENIED" || totalSpanDays <= 1) return reason;
    if (stripTime(day).getTime() === stripTime(new Date(request.startDate)).getTime()) {
      return `${reason} (Starts)`;
    }
    return reason;
  }

  function continuationLabel(request: any) {
    const name = request.requester?.fullName?.trim() || "Staff";
    const parts = name.split(/\s+/);
    const short = parts.length > 1 ? parts[parts.length - 1]! : parts[0]!;
    const reason = request.reason?.label ?? "Leave";
    const word = reason.split(/\s+/)[0] ?? reason;
    return `${short} ${word} continued`;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-[1.5rem] font-semibold tracking-tight text-text">Leave of Absence</h1>
        <div className="flex flex-wrap items-center gap-3">
          {/* List / Calendar segmented control */}
          <div
            className="inline-flex items-center gap-0.5 rounded-[14px] bg-[#F1F3F5] p-1"
            role="group"
            aria-label="Leave view"
          >
            <Link
              href="/leave?view=list"
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-[0.8125rem] font-medium calm-transition ${
                !isCalendar
                  ? "bg-white text-text shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)]"
                  : "text-muted hover:text-text"
              }`}
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
              href="/leave?view=calendar"
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-[0.8125rem] font-medium calm-transition ${
                isCalendar
                  ? "bg-white text-text shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)]"
                  : "text-muted hover:text-text"
              }`}
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
            className="inline-flex items-center gap-2 rounded-xl bg-[#131b2e] px-4 py-2.5 text-[0.875rem] font-semibold text-white shadow-[0_1px_3px_rgba(0,0,0,0.12)] calm-transition hover:bg-[#1a2540]"
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

      {/* Stat cards — light grey panels per leave dashboard design */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Total pending"
          value={String(totalPending).padStart(2, "0")}
          tone="softGrey"
          accent="accent"
          accentPlacement="left"
        />
        <StatCard
          label="Approved (month)"
          value={String(approvedThisMonth).padStart(2, "0")}
          tone="softBlueGrey"
          accentPlacement="none"
        />
        <StatCard
          label="Denied (month)"
          value={String(deniedThisMonth).padStart(2, "0")}
          tone="softBlueGrey"
          accentPlacement="none"
        />
        <StatCard
          label="Average response"
          value={avgResponseStr}
          tone="softWarm"
          accentPlacement="none"
          labelClassName="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8B3A3A]"
          valueClassName="mt-1.5 text-[28px] font-bold leading-none tracking-[-0.02em] text-[#8B3A3A]"
        />
      </div>

      {/* Success banner */}
      {created && (
        <div className="flex items-center gap-3 rounded-xl border border-status-approved-border bg-status-approved-bg px-4 py-3">
          <svg
            className="h-4 w-4 shrink-0 text-scale-strong-text"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <p className="text-[0.875rem] text-scale-strong-text">
            Leave request submitted — you can track its status below.
          </p>
        </div>
      )}

      {isCalendar ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h2 className="text-[1.25rem] font-bold capitalize tracking-tight text-text">
                {monthLabel}
              </h2>
              <div className="flex items-center gap-0.5">
                <Link
                  href={`/leave?view=calendar&month=${prevMonthParam}`}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted calm-transition hover:bg-[#eceef0] hover:text-text"
                  aria-label="Previous month"
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
                <Link
                  href={`/leave?view=calendar&month=${nextMonthParam}`}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted calm-transition hover:bg-[#eceef0] hover:text-text"
                  aria-label="Next month"
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-5 text-[10px] font-bold uppercase tracking-[0.08em] text-muted">
              <span className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-[#9ca3af]" />
                Pending
              </span>
              <span className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-[#16a34a]" />
                Approved
              </span>
              <span className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-[#e11d48]" />
                Declined
              </span>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-sm">
            <div className="grid grid-cols-7 border-b border-[#e5e7eb] bg-[#F1F3F5]">
              {WEEKDAYS.map((wd) => (
                <div
                  key={wd}
                  className="border-r border-[#e5e7eb] py-2.5 text-center text-[10px] font-bold uppercase tracking-[0.09em] text-muted last:border-r-0"
                >
                  {wd}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div
                  key={`pad-${i}`}
                  className="min-h-[112px] border-b border-r border-[#eceef0] bg-[#fafbfc] last:border-r-0"
                />
              ))}

              {calDays.map((day) => {
                const key = localDayKey(day);
                const isToday = key === todayKey;
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0);
                const dayEnd = new Date(
                  day.getFullYear(),
                  day.getMonth(),
                  day.getDate(),
                  23,
                  59,
                  59,
                );

                const entries = calendarRequests.filter((r: any) => {
                  const rStart = new Date(r.startDate);
                  const rEnd = new Date(r.endDate);
                  return rStart <= dayEnd && rEnd >= dayStart;
                });

                const eventBlocks = entries.flatMap((request: any) => {
                  const rStart = new Date(request.startDate);
                  const rEnd = new Date(request.endDate);
                  const span = daysSpan(rStart, rEnd);
                  const range = monthOverlapRange(rStart, rEnd, calStart, calEnd);
                  if (!range) return [];
                  const d = stripTime(day);
                  if (d < range.os || d > range.oe) return [];

                  if (d.getTime() > range.os.getTime()) {
                    return [
                      {
                        key: `${request.id}-cont`,
                        type: "continuation" as const,
                        request,
                      },
                    ];
                  }

                  const st = request.status as string;
                  const bar =
                    st === "APPROVED"
                      ? "bg-[#16a34a]"
                      : st === "DENIED"
                        ? "bg-[#e11d48]"
                        : "bg-[#9ca3af]";
                  const wrap =
                    st === "APPROVED"
                      ? "bg-[#ecfdf5] border-[#bbf7d0]"
                      : st === "DENIED"
                        ? "bg-[#fff1f2] border-[#fecdd3]"
                        : "bg-[#f3f4f6] border-[#e5e7eb]";
                  const titleC =
                    st === "APPROVED"
                      ? "text-[#14532d]"
                      : st === "DENIED"
                        ? "text-[#881337]"
                        : "text-[#111827]";
                  const subC =
                    st === "APPROVED"
                      ? "text-[#166534]"
                      : st === "DENIED"
                        ? "text-[#9f1239]"
                        : "text-[#6b7280]";

                  return [
                    {
                      key: request.id,
                      type: "event" as const,
                      request,
                      bar,
                      wrap,
                      titleC,
                      subC,
                      title: calendarTitleForRequest(request, day, span),
                      showSpanDot: span > 1 && st !== "DENIED",
                    },
                  ];
                });

                return (
                  <div
                    key={key}
                    className={`group relative min-h-[112px] border-b border-r border-[#eceef0] p-1.5 last:border-r-0 ${
                      isWeekend ? "bg-[#f9fafb]" : "bg-white"
                    } ${isToday ? "ring-1 ring-inset ring-[#131b2e]/15" : ""}`}
                  >
                    <div className="mb-1 flex items-start justify-between gap-1">
                      <span
                        className={`text-[11px] font-bold tabular-nums ${
                          isToday ? "text-[#131b2e]" : isWeekend ? "text-[#9ca3af]" : "text-text"
                        }`}
                      >
                        {day.getDate()}
                      </span>
                      <div className="flex shrink-0 items-center gap-1">
                        {eventBlocks.some((b) => b.type === "event" && b.showSpanDot) && (
                          <span
                            className="mt-0.5 inline-block h-1.5 w-1.5 rounded-full bg-text"
                            title="Multi-day leave"
                          />
                        )}
                        {!isWeekend && (
                          <Link
                            href={`/leave/request?date=${key}`}
                            className="flex h-5 w-5 items-center justify-center rounded-md text-[13px] font-semibold leading-none text-muted opacity-0 calm-transition hover:bg-[#eceef0] hover:text-text group-hover:opacity-100"
                            title={`Request leave for ${day.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}
                          >
                            +
                          </Link>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      {eventBlocks.map((block) =>
                        block.type === "continuation" ? (
                          <div
                            key={block.key}
                            className="rounded-lg bg-[#f3f4f6] px-1.5 py-1 text-[9px] font-medium leading-tight text-[#94a3b8]"
                          >
                            {continuationLabel(block.request)}
                          </div>
                        ) : (
                          <Link
                            key={block.key}
                            href={`/leave/${block.request.id}`}
                            className={`block overflow-hidden rounded-lg border calm-transition hover:brightness-[0.98] ${block.wrap}`}
                          >
                            <div className="flex gap-0">
                              <div className={`w-1 shrink-0 self-stretch rounded-l-[7px] ${block.bar}`} />
                              <div className="min-w-0 flex-1 py-1.5 pl-2 pr-1.5">
                                <p
                                  className={`truncate text-[10px] font-bold leading-tight ${block.titleC}`}
                                >
                                  {block.title}
                                </p>
                                <p className={`mt-0.5 truncate text-[9px] font-medium ${block.subC}`}>
                                  {block.request.requester?.fullName ?? "Staff"}
                                </p>
                              </div>
                            </div>
                          </Link>
                        ),
                      )}
                    </div>
                  </div>
                );
              })}

              {Array.from({
                length: (7 - ((firstDayOfWeek + daysInMonth) % 7)) % 7,
              }).map((_, i) => (
                <div
                  key={`trail-${i}`}
                  className="min-h-[112px] border-b border-r border-[#eceef0] bg-[#fafbfc] last:border-r-0"
                />
              ))}
            </div>
          </div>
        </div>
      ) : !hasAnyListRows ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#d1d5db] bg-white py-16">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#f3f4f6]">
            <svg
              className="h-6 w-6 text-[#374151]"
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
          <Link
            href="/leave/request"
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#131b2e] px-4 py-2.5 text-[0.875rem] font-semibold text-white calm-transition hover:bg-[#1a2540]"
          >
            Submit first request
          </Link>
        </div>
      ) : (
        <LeaveTable pendingRows={pendingRows} completedRows={completedRows} isManager={manager} />
      )}
    </div>
  );
}
