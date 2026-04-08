import type { ReactNode } from "react";
import { Fragment } from "react";
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
import { MetaText } from "@/components/ui/typography";
import { StatusPill } from "@/components/ui/status-pill";
import {
  computeBehaviourAnalysis,
  type BehaviourAnalysisSummary,
} from "@/modules/analysis/behaviourAnalysis";
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

function sectionHeader(title: string, subtitle?: string) {
  return (
    <div className="px-6 py-4 sm:px-8 sm:py-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--on-surface-variant)]">
        {title}
      </p>
      {subtitle ? (
        <p className="mt-1 max-w-2xl text-[0.8125rem] leading-relaxed text-muted">{subtitle}</p>
      ) : null}
    </div>
  );
}

type SecondaryStat = {
  key: string;
  label: string;
  value: ReactNode;
  valueClass?: string;
};

function buildSecondaryStats(
  summary: BehaviourAnalysisSummary,
  labels: {
    positivePoints: string;
    negativePoints: string;
  },
  detentionPlural: string,
  internalExclusionPlural: string,
  suspensionPlural: string,
): SecondaryStat[] {
  const secondaryStats: SecondaryStat[] = [
    { key: "det", label: detentionPlural, value: summary.totalDetentions.toLocaleString() },
    {
      key: "ie",
      label: internalExclusionPlural,
      value: summary.totalInternalExclusions.toLocaleString(),
    },
    {
      key: "sus",
      label: suspensionPlural,
      value: summary.totalSuspensions.toLocaleString(),
    },
  ];
  if (summary.hasPositivePoints) {
    secondaryStats.push({
      key: "pos",
      label: labels.positivePoints,
      value: summary.totalPositivePoints.toLocaleString(),
      valueClass: "text-[var(--scale-strong-text)]",
    });
  }
  if (summary.hasNegativePoints) {
    secondaryStats.push({
      key: "neg",
      label: labels.negativePoints,
      value: summary.totalNegativePoints.toLocaleString(),
      valueClass: "text-[var(--scale-limited-text)]",
    });
  }
  return secondaryStats;
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

  const windowDays = parseWindow(
    Array.isArray(params.windowDays) ? params.windowDays[0] : params.windowDays,
  );
  const yearGroupFilter =
    (Array.isArray(params.yearGroup) ? params.yearGroup[0] : params.yearGroup) ?? "";
  const ppFilter = params.pp === "1";
  const sendFilter = params.send === "1";

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

  const computedAtStr = result.computedAt.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const secondaryStats = buildSecondaryStats(summary, labels, detentionPlural, internalExclusionPlural, suspensionPlural);

  return (
    <Fragment>
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
        subtitle="Cohort behaviour, attendance, and on-call patterns for the selected window."
        meta={
          <MetaText>
            {windowDays}d window · {summary.totalStudents.toLocaleString()} students · Updated {computedAtStr}
          </MetaText>
        }
      />

      {/* Cohort overview — matches Explorer / Students glass + metric typography */}
      <div className="mb-8 rounded-2xl glass-card p-6 sm:p-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0 lg:divide-x lg:divide-border/25">
          <div className="lg:pr-8">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Cohort</p>
            <p className="mt-2 text-[2.75rem] font-bold leading-none tracking-tight text-text sm:text-[3.25rem]">
              {summary.totalStudents.toLocaleString()}
            </p>
            <p className="mt-2 text-[0.8125rem] text-muted">Students in this filter</p>
          </div>

          <div className="sm:pl-0 lg:px-8">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Avg attendance</p>
            <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-text sm:text-[2.125rem]">
              {summary.attendanceMean !== null ? `${summary.attendanceMean.toFixed(1)}%` : "—"}
            </p>
            <p className="mt-2 text-[0.8125rem] text-muted">Mean on latest snapshot in window</p>
          </div>

          <div className="sm:pl-0 lg:px-8">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">High priority</p>
            <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-text sm:text-[2.125rem]">
              {summary.highPriorityCount}
            </p>
            <p className="mt-2 text-[0.8125rem] text-muted">Urgent &amp; priority pastoral bands</p>
          </div>

          <div className="sm:pl-0 lg:pl-8">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
              {onCallPlural} (imports)
            </p>
            <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-text sm:text-[2.125rem]">
              {summary.totalOnCalls}
            </p>
            <p className="mt-2 text-[0.8125rem] text-muted">Snapshot totals · not live requests</p>
          </div>
        </div>

        {secondaryStats.length > 0 && (
          <>
            <div className="styled-divider my-8" />
            <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
              Sanctions &amp; points
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {secondaryStats.map((s) => (
                <div
                  key={s.key}
                  className="rounded-xl bg-[var(--surface-container-low)] px-4 py-3.5 shadow-sm"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">{s.label}</p>
                  <p
                    className={`mt-1.5 text-xl font-bold tabular-nums tracking-tight text-[var(--on-surface)] ${s.valueClass ?? ""}`}
                  >
                    {s.value}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="mb-6">
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

      {/* Live on-call */}
      <div className="mb-8 overflow-hidden rounded-2xl glass-card">
        {sectionHeader(
          `${onCallPlural} · live`,
          "Requests in this window. Charts use school hours 8am–3pm. Use bars to open details.",
        )}

        {!hasOnCallFeature ? (
          <div className="border-t border-[var(--divider-subtle)] px-6 py-6 sm:px-8">
            <p className="text-sm leading-relaxed text-muted">
              On-call workflow is not enabled for this school. Enable the feature to see timing and teacher
              breakdowns; imported snapshots still include on-call counts in the overview above.
            </p>
          </div>
        ) : (
          <>
            <div className="border-t border-[var(--divider-subtle)]">
              <OnCallBreakdownCharts
                onCallByHour={result.onCallByHour}
                onCallByReason={result.onCallByReason}
                details={result.onCallRequestDetails}
              />
            </div>

            <div className="border-t border-[var(--divider-subtle)] px-6 py-6 sm:px-8">
              <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                Most frequent requesters
              </p>
              {topTeachers.length > 0 ? (
                <div className="table-shell">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="table-head-row text-left">
                          <th className="px-5 py-3">Teacher</th>
                          <th className="px-4 py-3 text-right">Requests</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topTeachers.map((row) => (
                          <tr key={row.teacherId} className="table-row calm-transition">
                            <td className="px-5 py-4 font-medium text-text">{row.teacherName}</td>
                            <td className="px-4 py-4 text-right tabular-nums text-muted">{row.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted">No on-call requests for this cohort in the window.</p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Suspensions */}
      <div className="mb-8 overflow-hidden rounded-2xl glass-card">
        {sectionHeader(
          suspensionPlural,
          `Students with at least one suspension on their latest snapshot (${summary.totalSuspensions.toLocaleString()} total on those records).`,
        )}

        {result.suspensionIncidents.length === 0 ? (
          <div className="border-t border-[var(--divider-subtle)] px-6 py-8 text-center sm:px-8">
            <p className="text-sm text-muted">No suspensions on the latest snapshot for this cohort.</p>
          </div>
        ) : (
          <div className="border-t border-[var(--divider-subtle)] p-6 sm:p-8 sm:pt-6">
            <div className="table-shell">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="table-head-row text-left">
                      <th className="px-5 py-3">Student</th>
                      <th className="px-4 py-3">Year</th>
                      <th className="px-4 py-3 text-right">Count</th>
                      <th className="px-4 py-3">Snapshot</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.suspensionIncidents.map((row) => (
                      <tr
                        key={`${row.studentId}-${row.snapshotDate.toISOString()}`}
                        className="table-row calm-transition"
                      >
                        <td className="px-5 py-4 font-medium text-text">
                          <Link
                            href={`/students/${row.studentId}`}
                            className="calm-transition hover:text-accent hover:underline"
                          >
                            {row.studentName}
                          </Link>
                        </td>
                        <td className="px-4 py-4 text-muted">{row.yearGroup ?? "—"}</td>
                        <td className="px-4 py-4 text-right tabular-nums text-muted">{row.suspensionsCount}</td>
                        <td className="px-4 py-4 tabular-nums text-muted">{fmtSnapshotDate(row.snapshotDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* High priority */}
      <div className="mb-8 overflow-hidden rounded-2xl glass-card">
        {sectionHeader(
          "High priority students",
          "Urgent and priority bands from the pastoral risk model (aligned with Explorer → Students).",
        )}

        {result.highPriorityStudents.length === 0 ? (
          <div className="flex flex-col items-center justify-center border-t border-[var(--divider-subtle)] py-14">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
              <svg className="h-6 w-6 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <circle cx="11" cy="11" r="6.5" />
                <path d="m16.5 16.5 3 3" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-[0.875rem] font-semibold text-text">No students in urgent or priority bands</p>
            <p className="mt-1 max-w-sm text-center text-[0.8125rem] text-muted">
              Widen filters or check back after the next data import.
            </p>
          </div>
        ) : (
          <div className="border-t border-[var(--divider-subtle)] p-6 sm:p-8 sm:pt-6">
            <div className="table-shell">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="table-head-row text-left">
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
                      <tr key={student.studentId} className="group table-row calm-transition">
                        <td className="px-5 py-4 font-medium text-text">
                          <Link
                            href={`/analysis/students/${student.studentId}?window=${windowDays}`}
                            className="calm-transition group-hover:text-accent hover:underline"
                          >
                            {student.studentName}
                          </Link>
                        </td>
                        <td className="px-4 py-4">
                          <StatusPill
                            variant={student.band === "URGENT" ? "error" : "warning"}
                            size="sm"
                          >
                            {student.band === "URGENT" ? "Urgent" : "Priority"}
                          </StatusPill>
                        </td>
                        <td className="px-4 py-4 text-muted">{student.yearGroup ?? "—"}</td>
                        <td className="px-4 py-4">
                          <div className="flex gap-1.5">
                            {student.ppFlag && <StatusPill variant="info" size="sm">PP</StatusPill>}
                            {student.sendFlag && <StatusPill variant="warning" size="sm">SEND</StatusPill>}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right tabular-nums text-muted">
                          {student.attendancePct !== null ? `${student.attendancePct.toFixed(1)}%` : "—"}
                        </td>
                        <td className="px-4 py-4 text-right tabular-nums text-muted">{student.detentionsCount}</td>
                        <td className="px-4 py-4 text-right tabular-nums text-muted">
                          {student.internalExclusionsCount}
                        </td>
                        <td className="px-4 py-4 text-right tabular-nums text-muted">{student.onCallsCount}</td>
                        {summary.hasPositivePoints && (
                          <td className="px-4 py-4 text-right tabular-nums text-muted">
                            {student.positivePointsTotal}
                          </td>
                        )}
                        {summary.hasNegativePoints && (
                          <td className="px-4 py-4 text-right tabular-nums text-muted">
                            {student.negativePointsTotal}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      <MetaText className="mt-2">Explorer · Behaviour analysis · {windowDays}d window</MetaText>
    </Fragment>
  );
}
