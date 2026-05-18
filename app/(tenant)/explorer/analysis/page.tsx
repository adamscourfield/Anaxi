import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { buildViewerContext } from "@/lib/viewerContext";
import {
  canViewExplorer,
  canViewBehaviourExplorer,
  canExportExplorer,
} from "@/modules/authz";
import { PageHeader } from "@/components/ui/page-header";
import { ExplorerBackLink } from "@/components/explorer/explorer-chrome";
import { MetaText } from "@/components/ui/typography";
import { StatusPill } from "@/components/ui/status-pill";
import { Avatar } from "@/components/ui/avatar";
import { BehaviourHeatmap } from "@/components/dashboard/BehaviourHeatmap";
import {
  computeBehaviourAnalysis,
  type OnCallRequestDetail,
} from "@/modules/analysis/behaviourAnalysis";
import { BehaviourAnalysisFilters } from "./BehaviourAnalysisFilters";
import { BehaviourAnalysisCollapsibleSection } from "./BehaviourAnalysisCollapsibleSection";
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
    <div className="px-5 py-4 sm:px-6 sm:py-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted">{title}</p>
      {subtitle ? (
        <p className="mt-1 max-w-2xl text-[0.8125rem] leading-relaxed text-muted">{subtitle}</p>
      ) : null}
    </div>
  );
}

function buildBehaviourHeatmapData(
  details: OnCallRequestDetail[],
  availableYearGroups: string[],
  selectedYearGroup?: string,
): { yearGroups: string[]; columnLabels: string[]; matrix: number[][]; incidents: import("@/modules/home/hydration").HeatmapCellIncident[][][] } | null {
  const columnLabels = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const baseYearGroups = selectedYearGroup
    ? [selectedYearGroup]
    : availableYearGroups.length > 0
      ? availableYearGroups
      : Array.from(new Set(details.map((detail) => detail.studentYearGroup).filter(Boolean) as string[]));

  if (baseYearGroups.length === 0) return null;

  const indexByYearGroup = new Map(baseYearGroups.map((yearGroup, index) => [yearGroup, index]));
  const matrix = baseYearGroups.map(() => [0, 0, 0, 0, 0]);
  const incidents: import("@/modules/home/hydration").HeatmapCellIncident[][][] =
    baseYearGroups.map(() => Array.from({ length: 5 }, () => []));

  for (const detail of details) {
    if (!detail.studentYearGroup) continue;
    const rowIndex = indexByYearGroup.get(detail.studentYearGroup);
    if (rowIndex === undefined) continue;
    const day = new Date(detail.createdAt).getDay();
    if (day < 1 || day > 5) continue;
    const colIndex = day - 1;
    matrix[rowIndex][colIndex] += 1;
    incidents[rowIndex][colIndex].push({
      id: detail.id,
      createdAt: detail.createdAt,
      studentName: detail.studentName,
      studentYearGroup: detail.studentYearGroup,
      requesterName: detail.requesterName,
      behaviourReasonCategory: detail.behaviourReasonCategory,
      status: detail.status,
      location: detail.location,
    });
  }

  const filteredRows = baseYearGroups
    .map((yearGroup, index) => ({ yearGroup, row: matrix[index], incRow: incidents[index] }))
    .filter(({ row }) => selectedYearGroup || row.some((value) => value > 0));

  if (filteredRows.length === 0) return null;

  return {
    yearGroups: filteredRows.map(({ yearGroup }) => yearGroup),
    columnLabels,
    matrix: filteredRows.map(({ row }) => row),
    incidents: filteredRows.map(({ incRow }) => incRow),
  };
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

  const viewerContext = await buildViewerContext(user);

  if (
    !canViewExplorer(viewerContext) ||
    !canViewBehaviourExplorer(viewerContext)
  )
    notFound();

  const showExport = canExportExplorer(viewerContext);

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

  const behaviourHeatmap = buildBehaviourHeatmapData(
    result.onCallRequestDetails,
    yearGroups,
    yearGroupFilter || undefined,
  );

  const suspensionStudentCount = result.suspensionIncidents.length;

  return (
    <div className="anx-reports-page space-y-8 pb-10 pt-1">
      <ExplorerBackLink />

      <PageHeader
        variant="ledger"
        eyebrowClassName="anx-eyebrow"
        eyebrow="Explorer"
        title="Behaviour analysis"
        subtitle="Cohort behaviour, attendance, and on-call patterns for the selected window."
        meta={
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
            <MetaText className="inline-flex items-center gap-1.5">
              <svg className="h-3.5 w-3.5 shrink-0 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
              </svg>
              {windowDays}d window
            </MetaText>
            <MetaText className="inline-flex items-center gap-1.5">
              <svg className="h-3.5 w-3.5 shrink-0 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeLinecap="round" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" />
              </svg>
              {summary.totalStudents.toLocaleString()} students
            </MetaText>
            <MetaText className="inline-flex items-center gap-1.5">
              <svg className="h-3.5 w-3.5 shrink-0 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 3" strokeLinecap="round" />
              </svg>
              Updated {computedAtStr}
            </MetaText>
          </div>
        }
        actions={
          showExport ? (
            <form action="/api/explorer/export" method="POST" className="inline">
              <input type="hidden" name="view" value="BEHAVIOUR_STUDENTS_TABLE" />
              <input type="hidden" name="windowDays" value={String(windowDays)} />
              {yearGroupFilter ? <input type="hidden" name="yearGroup" value={yearGroupFilter} /> : null}
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-[0.8125rem] font-semibold text-text shadow-sm calm-transition hover:bg-surface-container-low"
              >
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
                  <polyline points="7 10 12 15 17 10" strokeLinecap="round" strokeLinejoin="round" />
                  <line x1="12" y1="15" x2="12" y2="3" strokeLinecap="round" />
                </svg>
                Export
              </button>
            </form>
          ) : null
        }
      />

      <BehaviourAnalysisFilters
        id="behaviour-analysis-filters"
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

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
        <div className="anx-elevated-card flex gap-3 p-5 sm:gap-4 sm:p-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-container-low text-muted">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeLinecap="round" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted">Cohort</p>
            <p className="mt-1 text-[2rem] font-bold leading-none tracking-tight text-text sm:text-[2.35rem] tabular-nums">
              {summary.totalStudents.toLocaleString()}
            </p>
            <p className="mt-1.5 text-[0.8125rem] text-muted">Students in this filter</p>
          </div>
        </div>

        <div className="anx-elevated-card flex gap-3 p-5 sm:gap-4 sm:p-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-container-low text-muted">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M3 17l6-6 4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M14 7h7v7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted">Avg attendance</p>
            <p className="mt-1 text-[2rem] font-bold tabular-nums leading-none tracking-tight text-text sm:text-[2.35rem]">
              {summary.attendanceMean !== null ? `${summary.attendanceMean.toFixed(1)}%` : "—"}
            </p>
            <p className="mt-1.5 text-[0.8125rem] text-muted">Mean on latest snapshot in window</p>
          </div>
        </div>

        <div className="anx-elevated-card flex gap-3 p-5 sm:gap-4 sm:p-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-container-low text-muted">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 2l2.4 7.4h7.6l-6 4.6 2.3 7-6-4.6-6 4.6 2.3-7-6-4.6h7.6z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted">High priority</p>
            <p className="mt-1 text-[2rem] font-bold tabular-nums leading-none tracking-tight text-text sm:text-[2.35rem]">
              {summary.highPriorityCount}
            </p>
            <p className="mt-1.5 text-[0.8125rem] text-muted">Urgent &amp; priority pastoral bands</p>
          </div>
        </div>

        <div className="anx-elevated-card flex gap-3 p-5 sm:gap-4 sm:p-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-container-low text-muted">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted">{onCallPlural} (imports)</p>
            <p className="mt-1 text-[2rem] font-bold tabular-nums leading-none tracking-tight text-text sm:text-[2.35rem]">
              {summary.totalOnCalls}
            </p>
            <p className="mt-1.5 text-[0.8125rem] text-muted">Snapshot totals · not live requests</p>
          </div>
        </div>
      </div>

      <div id="behaviour-heatmap" className="anx-elevated-card overflow-hidden rounded-2xl scroll-mt-24">
        {sectionHeader(
          "Behaviour heatmap",
          "Weekday pattern of on-call incidents by year group for the selected window.",
        )}
        <div className="border-t border-outline-variant px-5 py-5 sm:px-6 sm:py-6">
          {!hasOnCallFeature ? (
            <p className="text-sm leading-relaxed text-muted">
              On-call workflow is not enabled for this school, so the live behaviour heatmap is unavailable.
            </p>
          ) : behaviourHeatmap ? (
            <BehaviourHeatmap
              yearGroups={behaviourHeatmap.yearGroups}
              columnLabels={behaviourHeatmap.columnLabels}
              matrix={behaviourHeatmap.matrix}
              incidents={behaviourHeatmap.incidents}
              subtitle="Weekday distribution for the current filters"
              hideCta
            />
          ) : (
            <p className="text-sm leading-relaxed text-muted">
              No on-call incidents matched the current filters in this window.
            </p>
          )}
        </div>
      </div>

      {/* On-call: charts (left) + frequent requesters (right) */}
      <div className="anx-elevated-card overflow-hidden rounded-2xl">
        {sectionHeader(
          `${onCallPlural} · live`,
          "Requests in this window. Charts use school hours 8am–3pm. Tap a bar to open details.",
        )}

        {!hasOnCallFeature ? (
          <div className="border-t border-outline-variant px-5 py-6 sm:px-6">
            <p className="text-sm leading-relaxed text-muted">
              On-call workflow is not enabled for this school. Enable the feature to see timing and teacher breakdowns;
              imported snapshots still include on-call counts in the overview above.
            </p>
          </div>
        ) : (
          <div className="border-t border-outline-variant">
            <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(280px,380px)] lg:divide-x lg:divide-outline-variant">
              <div className="min-w-0">
                <OnCallBreakdownCharts
                  onCallByHour={result.onCallByHour}
                  onCallByReason={result.onCallByReason}
                  details={result.onCallRequestDetails}
                  compact
                />
              </div>

              <aside className="flex flex-col border-t border-outline-variant p-5 sm:p-6 lg:border-t-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted">Most frequent requesters</p>
                <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">
                  Teachers raising the most on-call requests in this window.
                </p>
                <div className="mt-5 flex-1">
                  {topTeachers.length > 0 ? (
                    <div className="anx-elevated-card--table table-shell overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest">
                      <p className="sr-only" id="explorer-analysis-oncall-requesters-scroll-hint">
                        This table scrolls horizontally on small screens. Use touch or trackpad to see all columns.
                      </p>
                      <div className="overflow-x-auto" aria-describedby="explorer-analysis-oncall-requesters-scroll-hint">
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
                                <td className="px-5 py-3.5">
                                  <div className="flex items-center gap-2.5">
                                    <Avatar name={row.teacherName} size="sm" />
                                    <span className="font-medium text-text">{row.teacherName}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3.5 text-right tabular-nums text-muted">{row.count}</td>
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
              </aside>
            </div>
          </div>
        )}
      </div>

      {/* Suspensions */}
      <BehaviourAnalysisCollapsibleSection
        title={suspensionPlural}
        subtitle={`Students with at least one suspension on their latest snapshot (${summary.totalSuspensions.toLocaleString()} total on those records).`}
        countPill={
          <span className="inline-flex items-center rounded-md bg-surface-container-low px-2.5 py-1 text-[11px] font-semibold text-muted">
            {suspensionStudentCount} student{suspensionStudentCount === 1 ? "" : "s"}
          </span>
        }
        icon={
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-container-low text-muted">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" aria-hidden>
              <path d="M6 12h12" />
            </svg>
          </span>
        }
      >
        {result.suspensionIncidents.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm text-muted">No suspensions on the latest snapshot for this cohort.</p>
          </div>
        ) : (
          <div className="px-6 pb-6 pt-2">
            <div className="anx-behaviour-data-table-wrap">
              <p className="sr-only" id="explorer-analysis-suspensions-scroll-hint">
                This table scrolls horizontally on small screens. Use touch or trackpad to see all columns.
              </p>
              <div className="overflow-x-auto" aria-describedby="explorer-analysis-suspensions-scroll-hint">
                <table className="min-w-[480px] text-sm">
                  <thead>
                    <tr>
                      <th className="text-left">Student</th>
                      <th className="text-left">Year</th>
                      <th className="text-right">Count</th>
                      <th className="text-left">Snapshot</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.suspensionIncidents.map((row) => (
                      <tr key={`${row.studentId}-${row.snapshotDate.toISOString()}`}>
                        <td>
                          <div className="flex min-w-0 items-center gap-2.5">
                            <Avatar name={row.studentName} size="sm" />
                            <Link
                              href={`/students/${row.studentId}`}
                              className="truncate font-medium text-text underline underline-offset-2 calm-transition hover:text-muted"
                            >
                              {row.studentName}
                            </Link>
                          </div>
                        </td>
                        <td className="text-muted">{row.yearGroup ?? "—"}</td>
                        <td className="text-right tabular-nums text-muted">{row.suspensionsCount}</td>
                        <td className="tabular-nums text-muted">{fmtSnapshotDate(row.snapshotDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </BehaviourAnalysisCollapsibleSection>

      {/* High priority */}
      <BehaviourAnalysisCollapsibleSection
        title="High priority students"
        subtitle={
          <>
            Urgent and priority bands from the pastoral risk model (aligned with{" "}
            <Link
              href="/explorer/students"
              className="text-muted underline underline-offset-2 calm-transition hover:text-text"
            >
              Explorer
            </Link>{" "}
            → Students).
          </>
        }
        countPill={
          <span className="inline-flex items-center rounded-md bg-surface-container-low px-2.5 py-1 text-[11px] font-semibold text-muted">
            {result.highPriorityStudents.length} student{result.highPriorityStudents.length === 1 ? "" : "s"}
          </span>
        }
        icon={
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-container-low text-muted">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 2l2.4 7.4h7.6l-6 4.6 2.3 7-6-4.6-6 4.6 2.3-7-6-4.6h7.6z" />
            </svg>
          </span>
        }
      >
        {result.highPriorityStudents.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-14">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-md bg-surface-container-low">
              <svg className="h-6 w-6 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
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
          <div className="px-6 pb-6 pt-2">
            <div className="anx-behaviour-data-table-wrap">
              <p className="sr-only" id="explorer-analysis-high-priority-scroll-hint">
                This table scrolls horizontally on small screens. Use touch or trackpad to see all columns.
              </p>
              <div className="overflow-x-auto" aria-describedby="explorer-analysis-high-priority-scroll-hint">
                <table className="min-w-[720px] text-sm">
                  <thead>
                    <tr>
                      <th className="text-left">Student</th>
                      <th className="text-left">Band</th>
                      <th className="text-left">Year</th>
                      <th className="text-left">Flags</th>
                      <th className="text-right">Attendance</th>
                      <th className="text-right">{detentionPlural}</th>
                      <th className="text-right">{internalExclusionPlural}</th>
                      <th className="text-right">{onCallPlural}</th>
                      {summary.hasPositivePoints ? (
                        <th className="text-right">{labels.positivePoints}</th>
                      ) : null}
                      {summary.hasNegativePoints ? (
                        <th className="text-right">{labels.negativePoints}</th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {result.highPriorityStudents.map((student) => (
                      <tr key={student.studentId}>
                        <td>
                          <div className="flex min-w-0 items-center gap-2.5">
                            <Avatar name={student.studentName} size="sm" />
                            <Link
                              href={`/analysis/students/${student.studentId}?window=${windowDays}`}
                              className="truncate font-medium text-text underline underline-offset-2 calm-transition hover:text-muted"
                            >
                              {student.studentName}
                            </Link>
                          </div>
                        </td>
                        <td>
                          <StatusPill
                            variant={student.band === "URGENT" ? "error" : "warning"}
                            size="sm"
                            className={
                              student.band === "URGENT"
                                ? "!bg-[#FEF2F2] !text-[#991B1B] !ring-1 !ring-inset !ring-[#FECACA]"
                                : "!bg-[#FFF7ED] !text-[#9A3412] !ring-1 !ring-inset !ring-[#FED7AA]"
                            }
                          >
                            {student.band === "URGENT" ? "Urgent" : "Priority"}
                          </StatusPill>
                        </td>
                        <td className="text-muted">{student.yearGroup ?? "—"}</td>
                        <td>
                          <div className="flex flex-wrap gap-1.5">
                            {student.ppFlag ? (
                              <StatusPill
                                variant="info"
                                size="sm"
                                className="!bg-[#F3E8FF] !text-[#6B21A8] !ring-1 !ring-inset !ring-[#E9D5FF]"
                              >
                                PP
                              </StatusPill>
                            ) : null}
                            {student.sendFlag ? (
                              <StatusPill
                                variant="warning"
                                size="sm"
                                className="!bg-[#FFF7ED] !text-[#9A3412] !ring-1 !ring-inset !ring-[#FED7AA]"
                              >
                                SEND
                              </StatusPill>
                            ) : null}
                          </div>
                        </td>
                        <td className="text-right tabular-nums text-muted">
                          {student.attendancePct !== null ? `${student.attendancePct.toFixed(1)}%` : "—"}
                        </td>
                        <td className="text-right tabular-nums text-muted">{student.detentionsCount}</td>
                        <td className="text-right tabular-nums text-muted">{student.internalExclusionsCount}</td>
                        <td className="text-right tabular-nums text-muted">{student.onCallsCount}</td>
                        {summary.hasPositivePoints ? (
                          <td className="text-right text-sm font-bold tabular-nums text-[var(--scale-strong-text)]">
                            {student.positivePointsTotal}
                          </td>
                        ) : null}
                        {summary.hasNegativePoints ? (
                          <td className="text-right tabular-nums text-muted">{student.negativePointsTotal}</td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </BehaviourAnalysisCollapsibleSection>

      <MetaText className="mt-2">Explorer · Behaviour analysis · {windowDays}d window</MetaText>
    </div>
  );
}
