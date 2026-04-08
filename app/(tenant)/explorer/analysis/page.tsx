import type { ReactNode } from "react";
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
import { computeBehaviourAnalysis } from "@/modules/analysis/behaviourAnalysis";
import { BehaviourAnalysisFilters } from "./BehaviourAnalysisFilters";
import { OnCallBreakdownCharts } from "./OnCallBreakdownCharts";

/* ─── Constants ────────────────────────────────────────────────────────────── */

const VALID_WINDOWS = [7, 21, 28] as const;
type WindowDays = (typeof VALID_WINDOWS)[number];

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

function parseWindow(raw: string | undefined): WindowDays {
  const n = Number(raw);
  return VALID_WINDOWS.includes(n as WindowDays) ? (n as WindowDays) : 21;
}

/** Avoid double "s" when tenant labels are already plural (e.g. "Detentions"). */
function pluralLabel(base: string): string {
  const t = base.trim();
  if (!t) return base;
  if (/s$/i.test(t)) return t;
  return `${t}s`;
}

function fmtSnapshotDate(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
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

  const detentionPlural = pluralLabel(labels.detention);
  const internalExclusionPlural = pluralLabel(labels.internalExclusion);
  const suspensionPlural = pluralLabel(labels.suspension);
  const onCallPlural = pluralLabel(labels.onCall);

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
  const topTeachers = result.onCallByTeacher.slice(0, 10);

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
  const clearHref = `/explorer/analysis?windowDays=${windowDays}`;

  type SummaryTile = {
    key: string;
    title: string;
    value: ReactNode;
    valueClass?: string;
    footnote?: string;
  };

  const summaryTiles: SummaryTile[] = [
    {
      key: "students",
      title: "Total students",
      value: summary.totalStudents,
    },
    {
      key: "attendance",
      title: "Avg attendance",
      value:
        summary.attendanceMean !== null ? `${summary.attendanceMean.toFixed(1)}%` : "—",
    },
  ];

  if (summary.hasPositivePoints) {
    summaryTiles.push({
      key: "pos",
      title: labels.positivePoints,
      value: summary.totalPositivePoints.toLocaleString(),
      valueClass: "text-scale-strong-text",
    });
  }
  if (summary.hasNegativePoints) {
    summaryTiles.push({
      key: "neg",
      title: labels.negativePoints,
      value: summary.totalNegativePoints.toLocaleString(),
      valueClass: "text-scale-limited-text",
    });
  }

  summaryTiles.push(
    {
      key: "det",
      title: detentionPlural,
      value: summary.totalDetentions.toLocaleString(),
    },
    {
      key: "ie",
      title: internalExclusionPlural,
      value: summary.totalInternalExclusions.toLocaleString(),
    },
    {
      key: "oc",
      title: `${onCallPlural} (snapshots)`,
      value: summary.totalOnCalls,
    },
    {
      key: "hp",
      title: "High priority",
      value: summary.highPriorityCount,
      footnote: "Urgent & priority bands",
    },
  );

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

      <div className="mt-6">
        <BehaviourAnalysisFilters
          yearGroups={yearGroups}
          defaults={{
            windowDays,
            yearGroup: yearGroupFilter,
            pp: ppFilter,
            send: sendFilter,
          }}
          hasActiveFilters={hasActiveFilters}
          buildClearHref={clearHref}
        />
      </div>

      {/* ── Summary stats (uniform card height) ───────────────────────── */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
        {summaryTiles.map((tile) => (
          <div
            key={tile.key}
            className="flex min-h-[7.5rem] flex-col justify-between rounded-2xl bg-surface p-4 shadow-ambient"
          >
            <div>
              <p className="text-sm font-medium text-muted">{tile.title}</p>
              <p
                className={`mt-2 text-2xl font-bold tabular-nums text-text ${tile.valueClass ?? ""}`}
              >
                {tile.value}
              </p>
            </div>
            {tile.footnote ? (
              <p className="mt-2 text-[0.6875rem] leading-snug text-muted">{tile.footnote}</p>
            ) : (
              <span className="mt-2 block min-h-[1rem]" aria-hidden />
            )}
          </div>
        ))}
      </div>

      {/* ── On Call Analysis (live requests; requires ON_CALL feature) ── */}
      <div className="mt-6 overflow-hidden rounded-2xl glass-card">
        <div className="border-b border-border/30 px-6 py-4">
          <h2 className="text-base font-semibold text-text">{onCallPlural} (live requests)</h2>
          <p className="mt-1 text-[0.8125rem] text-muted">
            Requests logged in this window. Chart shows 8am–3pm only. Snapshot totals are in the summary cards above.
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
            <OnCallBreakdownCharts
              onCallByHour={result.onCallByHour}
              onCallByReason={result.onCallByReason}
              details={result.onCallRequestDetails}
            />

            <div className="border-t border-border/30 px-6 pb-6">
              <h3 className="mb-3 text-[0.8125rem] font-semibold uppercase tracking-[0.08em] text-muted">
                Top teachers (by requests)
              </h3>
              {topTeachers.length > 0 ? (
                <div className="overflow-hidden rounded-xl border border-border/20">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/30 bg-surface-container-lowest/40 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
                        <th className="px-3 py-2">Teacher</th>
                        <th className="px-3 py-2 text-right">Requests</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topTeachers.map((row) => (
                        <tr
                          key={row.teacherId}
                          className="border-b border-border/20 last:border-0 calm-transition hover:bg-surface-container-lowest/50"
                        >
                          <td className="px-3 py-2 font-medium text-text">{row.teacherName}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-muted">{row.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted">No on-call requests in this window for the filtered cohort.</p>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Suspensions (snapshot detail) ── */}
      <div className="mt-6 overflow-hidden rounded-2xl glass-card">
        <div className="border-b border-border/30 px-6 py-4">
          <h2 className="text-base font-semibold text-text">{suspensionPlural}</h2>
          <p className="mt-1 text-[0.8125rem] text-muted">
            Students with at least one suspension on their latest snapshot in this window ({summary.totalSuspensions}{" "}
            total incidents recorded).
          </p>
        </div>

        {result.suspensionIncidents.length === 0 ? (
          <div className="p-6">
            <p className="text-sm text-muted">No suspensions on the latest snapshot for this cohort.</p>
          </div>
        ) : (
          <div className="overflow-x-auto p-6 pt-4">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-border/30 bg-surface-container-lowest/40 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Year</th>
                  <th className="px-4 py-3 text-right">Count</th>
                  <th className="px-4 py-3">Snapshot date</th>
                </tr>
              </thead>
              <tbody>
                {result.suspensionIncidents.map((row) => (
                  <tr
                    key={`${row.studentId}-${row.snapshotDate.toISOString()}`}
                    className="border-b border-border/20 last:border-0 calm-transition hover:bg-surface-container-lowest/50"
                  >
                    <td className="px-4 py-3 font-medium text-text">
                      <Link
                        href={`/students/${row.studentId}`}
                        className="calm-transition hover:text-accent hover:underline"
                      >
                        {row.studentName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted">{row.yearGroup ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted">{row.suspensionsCount}</td>
                    <td className="px-4 py-3 tabular-nums text-muted">{fmtSnapshotDate(row.snapshotDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
                  <th className="px-4 py-3 text-right">{detentionPlural}</th>
                  <th className="px-4 py-3 text-right">{internalExclusionPlural}</th>
                  <th className="px-4 py-3 text-right">{onCallPlural}</th>
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
