import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import {
  canViewExplorer,
  canViewBehaviourExplorer,
} from "@/modules/authz";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import {
  computeBehaviourAnalysis,
  type OnCallByHourRow,
} from "@/modules/analysis/behaviourAnalysis";

/* ─── Constants ────────────────────────────────────────────────────────────── */

const VALID_WINDOWS = [7, 21, 28] as const;
type WindowDays = (typeof VALID_WINDOWS)[number];

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

function parseWindow(raw: string | undefined): WindowDays {
  const n = Number(raw);
  return VALID_WINDOWS.includes(n as WindowDays) ? (n as WindowDays) : 21;
}

function fmtHour(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

function barWidthPct(count: number, max: number): number {
  if (max === 0) return 0;
  return Math.round((count / max) * 100);
}

/* ─── Page ─────────────────────────────────────────────────────────────────── */

export default async function AnalysisPage({
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
    Array.isArray(params.windowDays) ? params.windowDays[0] : params.windowDays,
  );
  const yearGroupFilter =
    (Array.isArray(params.yearGroup) ? params.yearGroup[0] : params.yearGroup) ?? "";
  const ppFilter = params.pp === "1";
  const sendFilter = params.send === "1";

  // ── tenant settings + features ────────────────────────────────────
  const [tenantSettings, onCallFeature] = await Promise.all([
    (prisma as any).tenantSettings.findUnique({
      where: { tenantId: user.tenantId },
    }),
    (prisma as any).tenantFeature.findUnique({
      where: { tenantId_key: { tenantId: user.tenantId, key: "ON_CALL" } },
    }),
  ]);
  const hasOnCallFeature = onCallFeature?.enabled === true;
  const labels = {
    positivePoints: tenantSettings?.positivePointsLabel ?? "Positive Points",
    negativePoints: tenantSettings?.negativePointsLabel ?? "Negative Points",
    detention: tenantSettings?.detentionLabel ?? "Detention",
    internalExclusion: tenantSettings?.internalExclusionLabel ?? "Internal Exclusion",
    suspension: tenantSettings?.suspensionLabel ?? "Suspension",
    onCall: tenantSettings?.onCallLabel ?? "On Call",
  };

  // ── data ────────────────────────────────────────────────────────
  const result = await computeBehaviourAnalysis(
    user.tenantId,
    windowDays,
    {
      yearGroup: yearGroupFilter || undefined,
      ppOnly: ppFilter || undefined,
      sendOnly: sendFilter || undefined,
    },
    { viewerUserId: user.id, hasOnCallFeature },
  );

  const { summary } = result;

  // ── year groups (for filter dropdown) ───────────────────────────
  const allStudents = await (prisma as any).student.findMany({
    where: { tenantId: user.tenantId, status: "ACTIVE" },
    select: { yearGroup: true },
    distinct: ["yearGroup"],
  });
  const yearGroups = (allStudents as any[])
    .map((s: any) => s.yearGroup as string | null)
    .filter((yg): yg is string => yg !== null)
    .sort();

  const hasActiveFilters = !!yearGroupFilter || ppFilter || sendFilter;

  // ── on-call hour chart max ──────────────────────────────────────
  const maxHourCount = Math.max(
    ...result.onCallByHour.map((r: OnCallByHourRow) => r.count),
    1,
  );

  // ── url builder ─────────────────────────────────────────────────
  function buildUrl(overrides: Record<string, string | undefined>) {
    const merged: Record<string, string> = {
      windowDays: String(windowDays),
      ...(yearGroupFilter ? { yearGroup: yearGroupFilter } : {}),
      ...(ppFilter ? { pp: "1" } : {}),
      ...(sendFilter ? { send: "1" } : {}),
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
    return `/explorer/analysis${qs ? `?${qs}` : ""}`;
  }

  // ── render ──────────────────────────────────────────────────────
  return (
    <>
      {/* Back link */}
      <div className="mb-4">
        <Link
          href="/explorer"
          className="inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-muted calm-transition hover:text-accent"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to Explorer
        </Link>
      </div>

      <PageHeader
        title="Behaviour analysis"
        subtitle="School behaviour and attendance — on-call patterns, points, sanctions, and students in urgent or priority pastoral bands."
        meta={
          <span className="text-xs text-muted">
            {windowDays}d window · {summary.totalStudents} student
            {summary.totalStudents !== 1 ? "s" : ""} · Updated{" "}
            {result.computedAt.toLocaleDateString("en-GB")}
          </span>
        }
      />

      {/* ── Filter bar ──────────────────────────────────────────── */}
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

            {/* PP filter */}
            <label className="flex items-center gap-2 rounded-lg border border-border/40 bg-surface-container-lowest/70 px-3 py-2">
              <input
                type="checkbox"
                name="pp"
                value="1"
                defaultChecked={ppFilter}
                className="h-4 w-4 rounded border-border accent-accent"
              />
              <span className="text-[0.8125rem] font-medium text-text">PP</span>
            </label>

            {/* SEND filter */}
            <label className="flex items-center gap-2 rounded-lg border border-border/40 bg-surface-container-lowest/70 px-3 py-2">
              <input
                type="checkbox"
                name="send"
                value="1"
                defaultChecked={sendFilter}
                className="h-4 w-4 rounded border-border accent-accent"
              />
              <span className="text-[0.8125rem] font-medium text-text">SEND</span>
            </label>

            <button
              type="submit"
              className="rounded-lg bg-accent px-4 py-2 text-[0.8125rem] font-semibold text-on-primary calm-transition hover:bg-accentHover"
            >
              Apply
            </button>
          </form>

          {hasActiveFilters && (
            <Link
              href={buildUrl({ yearGroup: undefined, pp: undefined, send: undefined })}
              className="rounded-lg border border-border bg-surface-container-lowest/70 px-4 py-2 text-[0.8125rem] font-medium text-muted calm-transition hover:text-text"
            >
              Clear
            </Link>
          )}
        </div>
      </div>

      {/* ── Summary stats ───────────────────────────────────────── */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <div className="rounded-2xl bg-surface p-4 shadow-ambient">
          <p className="text-sm font-medium text-muted">Total Students</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-text">
            {summary.totalStudents}
          </p>
        </div>
        <div className="rounded-2xl bg-surface p-4 shadow-ambient">
          <p className="text-sm font-medium text-muted">Avg Attendance</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-text">
            {summary.attendanceMean !== null
              ? `${summary.attendanceMean.toFixed(1)}%`
              : "—"}
          </p>
        </div>
        {summary.hasPositivePoints && (
          <div className="rounded-2xl bg-surface p-4 shadow-ambient">
            <p className="text-sm font-medium text-muted">{labels.positivePoints}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-scale-strong-text">
              {summary.totalPositivePoints.toLocaleString()}
            </p>
          </div>
        )}
        {summary.hasNegativePoints && (
          <div className="rounded-2xl bg-surface p-4 shadow-ambient">
            <p className="text-sm font-medium text-muted">{labels.negativePoints}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-scale-limited-text">
              {summary.totalNegativePoints.toLocaleString()}
            </p>
          </div>
        )}
        <div className="rounded-2xl bg-surface p-4 shadow-ambient">
          <p className="text-sm font-medium text-muted">{labels.detention}s</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-text">
            {summary.totalDetentions.toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl bg-surface p-4 shadow-ambient">
          <p className="text-sm font-medium text-muted">{labels.internalExclusion}s</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-text">
            {summary.totalInternalExclusions.toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl bg-surface p-4 shadow-ambient">
          <p className="text-sm font-medium text-muted">{labels.onCall}s (snapshots)</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-text">
            {summary.totalOnCalls}
          </p>
        </div>
        <div className="rounded-2xl bg-surface p-4 shadow-ambient">
          <p className="text-sm font-medium text-muted">High priority</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-text">
            {summary.highPriorityCount}
          </p>
          <p className="mt-1 text-[0.6875rem] text-muted">Urgent &amp; priority bands</p>
        </div>
      </div>

      {/* ── On Call Analysis (live requests; requires ON_CALL feature) ── */}
      <div className="mt-6 overflow-hidden rounded-2xl glass-card">
        <div className="border-b border-border/30 px-6 py-4">
          <h2 className="text-base font-semibold text-text">{labels.onCall} requests</h2>
          <p className="mt-1 text-[0.8125rem] text-muted">
            Live requests in this window, by time of day and requesting teacher. Snapshot totals above come from imports.
          </p>
        </div>

        {!hasOnCallFeature ? (
          <div className="p-6">
            <p className="text-sm text-muted">
              The on-call workflow is not enabled for this school. Enable the On Call feature to see request timing and
              teacher breakdowns; imported snapshot data still includes on-call counts.
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-6 p-6 lg:grid-cols-2">
              {/* By time of day */}
              <div>
                <h3 className="mb-4 text-[0.8125rem] font-semibold uppercase tracking-[0.08em] text-muted">
                  By time of day
                </h3>
                <div className="space-y-2">
                  {result.onCallByHour.map((row) => (
                    <div key={row.hour} className="flex items-center gap-3">
                      <span className="w-12 shrink-0 text-right text-xs tabular-nums text-muted">
                        {fmtHour(row.hour)}
                      </span>
                      <div className="relative h-6 flex-1 overflow-hidden rounded bg-surface-container-high">
                        {row.count > 0 && (
                          <div
                            className="h-full rounded bg-accent/80 calm-transition"
                            style={{ width: `${barWidthPct(row.count, maxHourCount)}%` }}
                          />
                        )}
                      </div>
                      <span className="w-8 text-right text-xs font-semibold tabular-nums text-text">
                        {row.count}
                      </span>
                    </div>
                  ))}
                </div>
                {result.onCallByHour.every((r) => r.count === 0) && (
                  <p className="mt-4 text-sm text-muted">No on-call requests in this window for the filtered cohort.</p>
                )}
              </div>

              {/* By teacher */}
              <div>
                <h3 className="mb-4 text-[0.8125rem] font-semibold uppercase tracking-[0.08em] text-muted">
                  By teacher (requester)
                </h3>
                {result.onCallByTeacher.length > 0 ? (
                  <div className="overflow-hidden rounded-xl border border-border/20">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/30 bg-surface-container-lowest/40 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
                          <th className="px-4 py-2.5">Teacher</th>
                          <th className="px-4 py-2.5 text-right">Requests</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.onCallByTeacher.map((row) => (
                          <tr
                            key={row.teacherId}
                            className="border-b border-border/20 last:border-0 calm-transition hover:bg-surface-container-lowest/50"
                          >
                            <td className="px-4 py-2.5 font-medium text-text">
                              {row.teacherName}
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums text-muted">
                              {row.count}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-muted">No on-call requests in this window for the filtered cohort.</p>
                )}
              </div>
            </div>

            {/* By reason */}
            {result.onCallByReason.length > 0 && (
              <div className="border-t border-border/30 p-6">
                <h3 className="mb-4 text-[0.8125rem] font-semibold uppercase tracking-[0.08em] text-muted">
                  By reason
                </h3>
                <div className="flex flex-wrap gap-3">
                  {result.onCallByReason.map((row) => (
                    <div
                      key={row.reason}
                      className="rounded-xl border border-border/30 bg-surface-container-lowest px-4 py-3"
                    >
                      <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
                        {row.reason}
                      </p>
                      <p className="mt-1 text-lg font-bold tabular-nums text-text">
                        {row.count}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Suspensions (summary row covers detentions & internal exclusions) ── */}
      <div className="mt-6 overflow-hidden rounded-2xl glass-card">
        <div className="border-b border-border/30 px-6 py-4">
          <h2 className="text-base font-semibold text-text">{labels.suspension}s</h2>
          <p className="mt-1 text-[0.8125rem] text-muted">From the latest snapshot in this window for the filtered cohort.</p>
        </div>
        <div className="p-6">
          <p className="text-3xl font-bold tabular-nums text-text">{summary.totalSuspensions.toLocaleString()}</p>
        </div>
      </div>

      {/* ── High priority students (urgent / priority pastoral bands) ── */}
      <div className="mt-6 overflow-hidden rounded-2xl glass-card">
        <div className="border-b border-border/30 px-6 py-4">
          <h2 className="text-base font-semibold text-text">
            High priority students
            {summary.highPriorityCount > 0 && (
              <span className="ml-2 text-sm font-normal text-muted">
                ({summary.highPriorityCount})
              </span>
            )}
          </h2>
          <p className="mt-1 text-[0.8125rem] text-muted">
            Students in urgent or priority bands from the pastoral risk model for this window (same logic as Explorer
            students).
          </p>
        </div>

        {result.highPriorityStudents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-[0.875rem] font-semibold text-text">
              No students in urgent or priority bands
            </p>
            <p className="mt-1 text-[0.8125rem] text-muted">
              Widen filters or check back after the next data import.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/30 bg-surface-container-lowest/40 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
                  <th className="px-5 py-3">Student</th>
                  <th className="px-4 py-3">Band</th>
                  <th className="px-4 py-3">Year</th>
                  <th className="px-4 py-3">Flags</th>
                  <th className="px-4 py-3 text-right">Attendance</th>
                  <th className="px-4 py-3 text-right">{labels.detention}s</th>
                  <th className="px-4 py-3 text-right">{labels.internalExclusion}s</th>
                  <th className="px-4 py-3 text-right">{labels.onCall}s</th>
                  {summary.hasPositivePoints && (
                    <th className="px-4 py-3 text-right">{labels.positivePoints}</th>
                  )}
                  {summary.hasNegativePoints && (
                    <th className="px-4 py-3 text-right">{labels.negativePoints}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {result.highPriorityStudents.map((student) => (
                  <tr
                    key={student.studentId}
                    className="group border-b border-border/20 last:border-0 calm-transition hover:bg-surface-container-lowest/50"
                  >
                    <td className="px-5 py-3 font-medium text-text">
                      <Link
                        href={`/analysis/students/${student.studentId}?window=${windowDays}`}
                        className="calm-transition group-hover:text-accent hover:underline"
                      >
                        {student.studentName}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill
                        variant={student.band === "URGENT" ? "error" : "warning"}
                        size="sm"
                      >
                        {student.band === "URGENT" ? "Urgent" : "Priority"}
                      </StatusPill>
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {student.yearGroup ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        {student.ppFlag && (
                          <StatusPill variant="info" size="sm">PP</StatusPill>
                        )}
                        {student.sendFlag && (
                          <StatusPill variant="warning" size="sm">SEND</StatusPill>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted">
                      {student.attendancePct !== null
                        ? `${student.attendancePct.toFixed(1)}%`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted">
                      {student.detentionsCount}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted">
                      {student.internalExclusionsCount}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted">
                      {student.onCallsCount}
                    </td>
                    {summary.hasPositivePoints && (
                      <td className="px-4 py-3 text-right tabular-nums text-muted">
                        {student.positivePointsTotal}
                      </td>
                    )}
                    {summary.hasNegativePoints && (
                      <td className="px-4 py-3 text-right tabular-nums text-muted">
                        {student.negativePointsTotal}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <p className="mt-8 text-[0.75rem] text-muted">
        Explorer · Behaviour analysis · {windowDays}d window
      </p>
    </>
  );
}
