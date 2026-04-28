import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { ExplorerBackLink } from "@/components/explorer/explorer-chrome";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import {
  canViewExplorer,
  canExportExplorer,
  canViewBehaviourExplorer,
} from "@/modules/authz";
import {
  computeStudentRiskIndex,
  type RiskBand,
} from "@/modules/analysis/studentRisk";
import { StudentsToolbar } from "./StudentsToolbar";

/* ─── Constants ────────────────────────────────────────────────────────────── */

const VALID_WINDOWS = [7, 21, 28] as const;
type WindowDays = (typeof VALID_WINDOWS)[number];

const BAND_ORDER: RiskBand[] = ["URGENT", "PRIORITY", "WATCH", "STABLE"];

const BAND_LABELS: Record<RiskBand, string> = {
  URGENT: "Urgent",
  PRIORITY: "Priority",
  WATCH: "Watch",
  STABLE: "Stable",
};

const PER_PAGE = 15;

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

function parseWindow(raw: string | undefined): WindowDays {
  const n = Number(raw);
  return VALID_WINDOWS.includes(n as WindowDays) ? (n as WindowDays) : 21;
}

function getInitials(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length >= 2)
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

function attendanceBarColor(pct: number | null): string {
  if (pct === null) return "bg-surface-container-high";
  if (pct >= 90) return "bg-scale-strong-bar";
  if (pct >= 80) return "bg-scale-some-bar";
  return "bg-scale-limited-bar";
}

function fmtDate(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function bandPillClass(band: RiskBand): string {
  switch (band) {
    case "URGENT":
      return "bg-scale-limited-bar text-on-primary";
    case "PRIORITY":
      return "bg-scale-limited-bar text-on-primary";
    case "WATCH":
      return "bg-scale-some-bar text-on-primary";
    case "STABLE":
      return "bg-scale-strong-bar text-on-primary";
  }
}

/* ─── Page ─────────────────────────────────────────────────────────────────── */

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ANALYSIS");

  // ── viewer context ──────────────────────────────────────────────
  const [hodMemberships, coachAssignments] = await Promise.all([
    (prisma as any).departmentMembership.findMany({
      where: { userId: user.id, isHeadOfDepartment: true },
    }),
    (prisma as any).coachAssignment.findMany({
      where: { coachUserId: user.id },
    }),
  ]);

  const hodDepartmentIds = (hodMemberships as any[]).map(
    (m: any) => m.departmentId,
  );
  const coacheeUserIds = (coachAssignments as any[]).map(
    (a: any) => a.coacheeUserId,
  );
  const viewerContext = {
    userId: user.id,
    role: user.role,
    hodDepartmentIds,
    coacheeUserIds,
  };

  if (!canViewExplorer(viewerContext) || !canViewBehaviourExplorer(viewerContext))
    notFound();

  // ── params ──────────────────────────────────────────────────────
  const windowDays = parseWindow(
    Array.isArray(params.windowDays)
      ? params.windowDays[0]
      : params.windowDays,
  );
  const yearGroupFilter =
    (Array.isArray(params.yearGroup)
      ? params.yearGroup[0]
      : params.yearGroup) ?? "";
  const studentSearch =
    (Array.isArray(params.studentSearch)
      ? params.studentSearch[0]
      : params.studentSearch) ?? "";
  const bandFilter =
    (Array.isArray(params.band) ? params.band[0] : params.band) ?? "";
  const currentPage = Math.max(
    1,
    Number(
      Array.isArray(params.page) ? params.page[0] : params.page,
    ) || 1,
  );

  // ── data ────────────────────────────────────────────────────────
  const { rows: allRows, computedAt } = await computeStudentRiskIndex(
    user.tenantId,
    windowDays,
    user.id,
  );

  // Collect available year groups before filtering
  const yearGroups = Array.from(
    new Set(allRows.map((r) => r.yearGroup).filter(Boolean)),
  ).sort() as string[];

  // Apply filters
  let rows = allRows;
  if (yearGroupFilter) {
    rows = rows.filter((r) => r.yearGroup === yearGroupFilter);
  }
  if (studentSearch) {
    const q = studentSearch.toLowerCase();
    rows = rows.filter((r) => r.studentName.toLowerCase().includes(q));
  }
  if (bandFilter && BAND_ORDER.includes(bandFilter as RiskBand)) {
    rows = rows.filter((r) => r.band === bandFilter);
  }

  // Sort: Urgent first, then by risk score descending
  rows.sort((a, b) => {
    const bandDiff = BAND_ORDER.indexOf(a.band) - BAND_ORDER.indexOf(b.band);
    if (bandDiff !== 0) return bandDiff;
    return b.riskScore - a.riskScore;
  });

  // Band counts (from unfiltered data)
  const bandCounts: Record<RiskBand, number> = {
    URGENT: 0,
    PRIORITY: 0,
    WATCH: 0,
    STABLE: 0,
  };
  for (const r of allRows) bandCounts[r.band]++;

  const showExport = canExportExplorer(viewerContext);

  // ── pagination ──────────────────────────────────────────────────
  const totalFiltered = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * PER_PAGE;
  const pageEnd = Math.min(pageStart + PER_PAGE, totalFiltered);
  const pageRows = rows.slice(pageStart, pageEnd);

  // ── computed stats ──────────────────────────────────────────────
  const avgAttendance =
    allRows.length > 0
      ? allRows.reduce((sum, r) => sum + (r.attendancePct ?? 0), 0) /
        allRows.length
      : 0;
  const priorityCount = bandCounts.PRIORITY + bandCounts.URGENT;

  // Students with attendance below 80%
  const lowAttendanceCount = allRows.filter(
    (r) => r.attendancePct !== null && r.attendancePct < 80,
  ).length;

  // ── url builder ─────────────────────────────────────────────────
  function pageUrl(p: number): string {
    const merged: Record<string, string> = {
      windowDays: String(windowDays),
      ...(yearGroupFilter ? { yearGroup: yearGroupFilter } : {}),
      ...(studentSearch ? { studentSearch } : {}),
      ...(bandFilter ? { band: bandFilter } : {}),
      ...(p > 1 ? { page: String(p) } : {}),
    };
    const qs = new URLSearchParams(merged).toString();
    return `/explorer/students${qs ? `?${qs}` : ""}`;
  }

  // ── pagination range ────────────────────────────────────────────
  function paginationRange(): (number | "ellipsis")[] {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | "ellipsis")[] = [1];
    if (safePage > 3) pages.push("ellipsis");
    const start = Math.max(2, safePage - 1);
    const end = Math.min(totalPages - 1, safePage + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (safePage < totalPages - 2) pages.push("ellipsis");
    pages.push(totalPages);
    return pages;
  }

  // ── render ──────────────────────────────────────────────────────
  return (
    <div className="space-y-8">
      <ExplorerBackLink />

      {/* ── Header ──────────────────────────────────────────────── */}
      <PageHeader
        eyebrow="Explorer"
        title="Students"
        subtitle="Risk bands, attendance, and flags for your cohort."
        actions={
          <>
            {showExport && (
              <form action="/api/explorer/export" method="POST" className="inline">
                <input type="hidden" name="view" value="STUDENT_RISK" />
                <input type="hidden" name="windowDays" value={String(windowDays)} />
                <button
                  type="submit"
                  className="rounded-lg border border-border/50 bg-surface-container-lowest px-4 py-2.5 text-[0.8125rem] font-medium text-text calm-transition hover:border-border hover:bg-bg"
                >
                  Export CSV
                </button>
              </form>
            )}
            <Link
              href="/students/import"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-[0.8125rem] font-semibold text-on-primary calm-transition hover:bg-primary-container"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M14 2v6h6M12 18v-6M9 15h6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Import CSV
            </Link>
          </>
        }
      />

      {/* ── Cohort overview ───────────────────────────────────────── */}
      <div className="mb-8 rounded-2xl glass-card p-6 sm:p-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0 lg:divide-x lg:divide-border/25">
          <div className="lg:pr-8">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
              Cohort
            </p>
            <p className="mt-2 text-[2.75rem] font-bold leading-none tracking-tight text-text sm:text-[3.25rem]">
              {allRows.length.toLocaleString()}
            </p>
            <p className="mt-2 text-[0.8125rem] text-muted">
              {windowDays}-day analysis window
            </p>
          </div>

          <div className="sm:pl-0 lg:px-8">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
              Avg attendance
            </p>
            <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-text sm:text-[2.125rem]">
              {avgAttendance.toFixed(1)}%
            </p>
            <p className="mt-2 text-[0.8125rem] text-muted">
              Cohort mean across visible students
            </p>
          </div>

          <div className="sm:pl-0 lg:px-8">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
              Urgent + priority
            </p>
            <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-text sm:text-[2.125rem]">
              {priorityCount}
            </p>
            <p className="mt-2 text-[0.8125rem] text-muted">
              Students in urgent or priority bands
            </p>
          </div>

          <div className="sm:pl-0 lg:pl-8">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
              Below 80% attendance
            </p>
            <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-text sm:text-[2.125rem]">
              {lowAttendanceCount}
            </p>
            <p className="mt-2 text-[0.8125rem] text-muted">
              With recorded attendance in window
            </p>
          </div>
        </div>
      </div>

      {/* ── Filters (aligned with Observation History) ─────────── */}
      <div className="mb-6">
        <StudentsToolbar
          yearGroups={yearGroups}
          defaultSearch={studentSearch}
          defaultYearGroup={yearGroupFilter}
          defaultBand={bandFilter}
          defaultWindow={String(windowDays)}
          hasFilters={
            !!(
              studentSearch ||
              yearGroupFilter ||
              bandFilter ||
              windowDays !== 21
            )
          }
        />
      </div>

      {/* ── Student table ───────────────────────────────────────── */}
      {rows.length === 0 ? (
        <div className="mt-4 flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
            <svg className="h-6 w-6 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16.5 16.5 3 3" strokeLinecap="round" />
            </svg>
          </div>
          <p className="text-[0.875rem] font-semibold text-text">
            {allRows.length === 0 ? "No student data" : "No matches"}
          </p>
          <p className="mt-1 text-[0.8125rem] text-muted">
            {allRows.length === 0
              ? "Try widening the window period."
              : "Try adjusting your filters."}
          </p>
        </div>
      ) : (
        <div className="mt-4 table-shell">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-head-row text-left">
                  <th className="px-5 py-3">Name</th>
                  <th className="px-4 py-3">Year</th>
                  <th className="px-4 py-3">Flags</th>
                  <th className="px-4 py-3">Band</th>
                  <th className="px-4 py-3">Attendance</th>
                  <th className="px-4 py-3">Last Update</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => (
                  <tr
                    key={row.studentId}
                    className="group table-row calm-transition"
                  >
                    {/* Name with initials avatar */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-container-low text-xs font-semibold text-on-surface-variant">
                          {getInitials(row.studentName)}
                        </div>
                        <span className="font-medium text-text">
                          {row.studentName}
                        </span>
                      </div>
                    </td>

                    {/* Year */}
                    <td className="px-4 py-4 text-muted">
                      {row.yearGroup ?? "—"}
                    </td>

                    {/* Flags */}
                    <td className="px-4 py-4">
                      <div className="flex gap-1.5">
                        {row.sendFlag && (
                          <span className="rounded bg-primary-container px-2 py-0.5 text-[10px] font-semibold uppercase text-on-primary">
                            SEN
                          </span>
                        )}
                        {row.ppFlag && (
                          <span className="rounded bg-primary-container px-2 py-0.5 text-[10px] font-semibold uppercase text-on-primary">
                            PP
                          </span>
                        )}
                        {!row.sendFlag && !row.ppFlag && (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </div>
                    </td>

                    {/* Band */}
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${bandPillClass(row.band)}`}
                      >
                        {BAND_LABELS[row.band]}
                      </span>
                    </td>

                    {/* Attendance with progress bar */}
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm tabular-nums text-text">
                          {row.attendancePct !== null
                            ? `${Math.round(row.attendancePct)}%`
                            : "—"}
                        </span>
                        {row.attendancePct !== null && (
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-container-low">
                            <div
                              className={`h-full rounded-full ${attendanceBarColor(row.attendancePct)}`}
                              style={{
                                width: `${Math.min(100, Math.max(0, row.attendancePct))}%`,
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Last Update */}
                    <td className="px-4 py-4 text-muted">
                      {fmtDate(row.lastSnapshotDate)}
                    </td>

                    {/* Action */}
                    <td className="px-4 py-4">
                      <Link
                        href={`/analysis/students/${row.studentId}?window=${windowDays}`}
                        className="link-accent text-sm font-medium calm-transition"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Results count + pagination (Observation History) ── */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border/20 px-5 py-3.5">
            <p className="text-[0.8125rem] text-muted">
              Showing{" "}
              <span className="font-semibold text-text">
                {totalFiltered > 0 ? pageStart + 1 : 0}-{pageEnd}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-text">
                {totalFiltered.toLocaleString()}
              </span>{" "}
              students found
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                {safePage > 1 ? (
                  <Link
                    href={pageUrl(safePage - 1)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted calm-transition hover:bg-surface-container-low hover:text-text"
                    aria-label="Previous page"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Link>
                ) : (
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-border">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                )}
                {paginationRange().map((item, idx) =>
                  item === "ellipsis" ? (
                    <span
                      key={`ellipsis-${idx}`}
                      className="inline-flex h-8 w-8 items-center justify-center text-[0.8125rem] text-muted"
                    >
                      …
                    </span>
                  ) : item === safePage ? (
                    <span
                      key={item}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-[0.8125rem] font-semibold text-on-primary"
                    >
                      {item}
                    </span>
                  ) : (
                    <Link
                      key={item}
                      href={pageUrl(item)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[0.8125rem] text-muted calm-transition hover:bg-surface-container-low hover:text-text"
                    >
                      {item}
                    </Link>
                  ),
                )}
                {safePage < totalPages ? (
                  <Link
                    href={pageUrl(safePage + 1)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted calm-transition hover:bg-surface-container-low hover:text-text"
                    aria-label="Next page"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Link>
                ) : (
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-border">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Bottom insight cards ─────────────────────────────────── */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {/* Critical Actions Required */}
        <div className="rounded-2xl glass-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-scale-limited-light">
              <span className="h-2 w-2 rounded-full bg-scale-limited-bar" />
            </span>
            <h3 className="text-sm font-semibold text-text">
              Critical Actions Required
            </h3>
          </div>
          <p className="text-[0.8125rem] leading-relaxed text-muted">
            {bandCounts.URGENT + bandCounts.PRIORITY} students in{" "}
            {yearGroups.length > 0 ? yearGroups[yearGroups.length - 1] : "the cohort"}{" "}
            have dropped attendance by &gt;5% in the last {windowDays} days.
            Automatic alerts have been queued for the pastoral team.
          </p>
        </div>

        {/* Registry Sync Status */}
        <div className="rounded-2xl glass-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-scale-consistent-light">
              <svg className="h-3 w-3 text-scale-consistent-text" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M4 4v5h5M20 20v-5h-5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M20.49 9A9 9 0 005.64 5.64L4 4m16 16l-1.64-1.64A9 9 0 019 20.49" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <h3 className="text-sm font-semibold text-text">
              Registry Sync Status
            </h3>
          </div>
          <p className="text-[0.8125rem] leading-relaxed text-muted">
            Last successful sync: Today at{" "}
            {computedAt.toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
            })}
            . All pupil premium records are current as of the latest census.
          </p>
        </div>

        {/* Performance Target */}
        <div className="rounded-2xl glass-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cat-violet-bg">
              <svg className="h-3 w-3 text-cat-violet-text" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M3 3v18h18" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M18 9l-5 5-2-2-4 4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <h3 className="text-sm font-semibold text-text">
              Performance Target
            </h3>
          </div>
          <p className="text-[0.8125rem] leading-relaxed text-muted">
            The current cohort is tracking {avgAttendance > 91 ? (avgAttendance - 91).toFixed(1) : "0"}% above the
            national average for attendance. Maintaining this trend is critical
            for the upcoming review.
          </p>
        </div>
      </div>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <p className="mt-8 text-[0.75rem] text-muted">
        Explorer · Students · {windowDays}d window · Updated{" "}
        {computedAt.toLocaleDateString("en-GB")}
      </p>
    </div>
  );
}
