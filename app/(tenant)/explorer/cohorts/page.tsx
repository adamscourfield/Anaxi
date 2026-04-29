import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import {
  canViewExplorer,
  canExportExplorer,
  canViewBehaviourExplorer,
} from "@/modules/authz";
import { PageHeader } from "@/components/ui/page-header";
import { ExplorerBackLink } from "@/components/explorer/explorer-chrome";
import {
  computeCohortPivot,
  type CohortPivotRow,
} from "@/modules/analysis/cohortPivot";

/* ─── Constants ────────────────────────────────────────────────────────────── */

const VALID_WINDOWS = [7, 21, 28] as const;
type WindowDays = (typeof VALID_WINDOWS)[number];

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

function parseWindow(raw: string | undefined): WindowDays {
  const n = Number(raw);
  return VALID_WINDOWS.includes(n as WindowDays) ? (n as WindowDays) : 21;
}

/**
 * Delta colour class.
 * `inverted` flips the meaning: for incident-type metrics a *positive* delta
 * is bad (more incidents), while for attendance a positive delta is good.
 */
function deltaClass(delta: number | null, inverted = false): string {
  if (delta === null) return "text-muted";
  if (delta === 0) return "text-muted";
  const isGood = inverted ? delta < 0 : delta > 0;
  return isGood ? "text-scale-strong-text" : "text-scale-some-text";
}

function fmtDelta(val: number | null, decimals = 2): string {
  if (val === null) return "—";
  return `${val > 0 ? "+" : ""}${val.toFixed(decimals)}`;
}

function fmtNum(val: number | null, decimals = 2): string {
  if (val === null) return "—";
  return val.toFixed(decimals);
}

/* ─── Page ─────────────────────────────────────────────────────────────────── */

export default async function CohortsPage({
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

  if (
    !canViewExplorer(viewerContext) ||
    !canViewBehaviourExplorer(viewerContext)
  )
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

  // ── data ────────────────────────────────────────────────────────
  const { rows: allRows, computedAt } = await computeCohortPivot(
    user.tenantId,
    windowDays,
  );

  // Available year groups (before filtering)
  const yearGroups = Array.from(
    new Set(allRows.map((r) => r.yearGroup)),
  ).sort();

  // Apply year-group filter
  let rows: CohortPivotRow[] = allRows;
  if (yearGroupFilter) {
    rows = rows.filter((r) => r.yearGroup === yearGroupFilter);
  }

  // ── summary ─────────────────────────────────────────────────────
  const totalStudents = rows.reduce((s, r) => s + r.studentsCovered, 0);
  const avgAttendance =
    rows.length > 0
      ? rows.reduce(
          (s, r) => s + (r.attendanceMean ?? 0) * r.studentsCovered,
          0,
        ) / (totalStudents || 1)
      : null;

  const showExport = canExportExplorer(viewerContext);
  const hasActiveFilters = !!yearGroupFilter;

  // ── url builder ─────────────────────────────────────────────────
  function buildUrl(overrides: Record<string, string | undefined>) {
    const merged: Record<string, string> = {
      windowDays: String(windowDays),
      ...(yearGroupFilter ? { yearGroup: yearGroupFilter } : {}),
      ...Object.fromEntries(
        Object.entries(overrides).filter(
          (e): e is [string, string] => e[1] !== undefined,
        ),
      ),
    };
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined) delete merged[k];
    }
    const qs = new URLSearchParams(merged).toString();
    return `/explorer/cohorts${qs ? `?${qs}` : ""}`;
  }

  // ── render ──────────────────────────────────────────────────────
  return (
    <div className="space-y-8">
      <ExplorerBackLink />

      <PageHeader variant="ledger"
        eyebrow="Explorer"
        title="Cohorts"
        subtitle="Year group behaviour metrics — attendance, incidents and welfare indicators aggregated by cohort."
        meta={
          <span className="text-xs text-muted">
            {windowDays}d window · {allRows.length} cohort
            {allRows.length !== 1 ? "s" : ""} · Updated{" "}
            {computedAt.toLocaleDateString("en-GB")}
          </span>
        }
      />

      {/* ── Controls bar ────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl bg-surface-container-low shadow-ambient">
        <div className="border-b border-border/30 px-5 py-3">
          <p className="text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-muted">Filters</p>
        </div>
        <div className="flex flex-wrap items-end gap-4 p-5 md:p-6">
          <form className="flex flex-wrap items-end gap-3">
            {/* Window selector */}
            <label className="flex flex-col gap-1">
              <span className="text-[0.6875rem] font-medium text-muted">Window</span>
              <select name="windowDays" defaultValue={String(windowDays)} className="field min-w-[100px]">
                {VALID_WINDOWS.map((w) => (
                  <option key={w} value={String(w)}>
                    {w} days
                  </option>
                ))}
              </select>
            </label>

            {/* Year group filter */}
            <label className="flex flex-col gap-1">
              <span className="text-[0.6875rem] font-medium text-muted">Year group</span>
              <select
                name="yearGroup"
                defaultValue={yearGroupFilter}
                className="field min-w-[120px]"
              >
                <option value="">All years</option>
                {yearGroups.map((yg) => (
                  <option key={yg} value={yg}>
                    {yg}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="submit"
              className="rounded-lg bg-accent px-4 py-2 text-[0.8125rem] font-semibold text-on-primary  calm-transition hover:bg-accentHover"
            >
              Apply
            </button>
          </form>

          {hasActiveFilters && (
            <Link
              href={buildUrl({ yearGroup: undefined })}
              className="rounded-lg border border-border bg-surface-container-lowest/70 px-4 py-2 text-[0.8125rem] font-medium text-muted calm-transition hover:text-text"
            >
              Clear
            </Link>
          )}
          {showExport && (
            <form action="/api/explorer/export" method="POST" className="inline">
              <input type="hidden" name="view" value="COHORT_PIVOT" />
              <input type="hidden" name="windowDays" value={String(windowDays)} />
              <button
                type="submit"
                className="rounded-lg border border-border bg-surface-container-lowest/70 px-4 py-2 text-[0.8125rem] font-medium text-muted calm-transition hover:text-text"
              >
                Export CSV
              </button>
            </form>
          )}
        </div>
      </div>

      {/* ── Summary row ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-surface p-4 shadow-ambient">
          <p className="text-sm font-medium text-muted">
            Total students
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-text">
            {totalStudents}
          </p>
        </div>
        <div className="rounded-2xl bg-surface p-4 shadow-ambient">
          <p className="text-sm font-medium text-muted">
            Avg attendance
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-text">
            {avgAttendance !== null ? `${avgAttendance.toFixed(1)}%` : "—"}
          </p>
        </div>
        <div className="rounded-2xl bg-surface p-4 shadow-ambient">
          <p className="text-sm font-medium text-muted">
            Cohorts
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-text">
            {rows.length}
          </p>
        </div>
      </div>

      {/* ── Cohort pivot table ──────────────────────────────────── */}
      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
            <svg className="h-6 w-6 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16.5 16.5 3 3" strokeLinecap="round" />
            </svg>
          </div>
          <p className="text-[0.875rem] font-semibold text-text">
            {allRows.length === 0 ? "No cohort data" : "No matches"}
          </p>
          <p className="mt-1 text-[0.8125rem] text-muted">
            {allRows.length === 0
              ? "Try widening the window period."
              : "Try adjusting your filter."}
          </p>
        </div>
      ) : (
        <div className="table-shell">
          <p className="sr-only" id="explorer-cohorts-scroll-hint">
            This table scrolls horizontally on small screens. Use touch or trackpad to see all columns.
          </p>
          <div className="overflow-x-auto" aria-describedby="explorer-cohorts-scroll-hint">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="table-head-row text-left">
                  <th className="px-5 py-3.5">Year Group</th>
                  <th className="px-4 py-3.5 text-right">Students</th>
                  <th className="px-4 py-3.5 text-right">Attendance</th>
                  <th className="px-4 py-3.5 text-right">Detentions</th>
                  <th className="px-4 py-3.5 text-right">On Calls</th>
                  <th className="px-4 py-3.5 text-right">Lateness</th>
                  <th className="px-4 py-3.5 text-right">Suspensions</th>
                  <th className="px-4 py-3.5 text-right">Exclusions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.yearGroup}
                    className="group table-row calm-transition"
                  >
                    {/* Year Group (linked) */}
                    <td className="px-5 py-3 font-medium text-text">
                      <Link
                        href={`/analysis/students?yearGroup=${encodeURIComponent(row.yearGroup)}&window=${windowDays}`}
                        className="link-accent calm-transition"
                      >
                        {row.yearGroup}
                      </Link>
                    </td>

                    {/* Students */}
                    <td className="px-4 py-3 text-right tabular-nums text-muted">
                      {row.studentsCovered}
                    </td>

                    {/* Attendance — positive delta = improving (good) */}
                    <td className="px-4 py-3 text-right tabular-nums text-muted">
                      {fmtNum(row.attendanceMean, 1)}%{" "}
                      <span className={deltaClass(row.attendanceDelta)}>
                        ({fmtDelta(row.attendanceDelta, 1)})
                      </span>
                    </td>

                    {/* Detentions — positive delta = worsening (inverted) */}
                    <td className="px-4 py-3 text-right tabular-nums text-muted">
                      {fmtNum(row.detentionsMean)}{" "}
                      <span
                        className={deltaClass(row.detentionsDelta, true)}
                      >
                        ({fmtDelta(row.detentionsDelta)})
                      </span>
                    </td>

                    {/* On Calls — positive delta = worsening (inverted) */}
                    <td className="px-4 py-3 text-right tabular-nums text-muted">
                      {fmtNum(row.onCallsMean)}{" "}
                      <span
                        className={deltaClass(row.onCallsDelta, true)}
                      >
                        ({fmtDelta(row.onCallsDelta)})
                      </span>
                    </td>

                    {/* Lateness — positive delta = worsening (inverted) */}
                    <td className="px-4 py-3 text-right tabular-nums text-muted">
                      {fmtNum(row.latenessMean)}{" "}
                      <span
                        className={deltaClass(row.latenessDelta, true)}
                      >
                        ({fmtDelta(row.latenessDelta)})
                      </span>
                    </td>

                    {/* Suspensions — positive delta = worsening (inverted) */}
                    <td className="px-4 py-3 text-right tabular-nums text-muted">
                      {row.suspensionsCount}{" "}
                      <span
                        className={deltaClass(row.suspensionsDelta, true)}
                      >
                        ({fmtDelta(row.suspensionsDelta, 0)})
                      </span>
                    </td>

                    {/* Internal Exclusions — positive delta = worsening (inverted) */}
                    <td className="px-4 py-3 text-right tabular-nums text-muted">
                      {row.internalExclusionsCount}{" "}
                      <span
                        className={deltaClass(
                          row.internalExclusionsDelta,
                          true,
                        )}
                      >
                        ({fmtDelta(row.internalExclusionsDelta, 0)})
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Footer ──────────────────────────────────────────────── */}
      <p className="mt-8 text-[0.75rem] text-muted">
        Explorer · Cohorts · {windowDays}d window
      </p>
    </div>
  );
}
