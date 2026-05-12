import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
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
  type BehaviourAnalysisSummary,
  type BehaviourCohortDailyMetricRow,
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

/** Sparkline from real daily cohort series; slope reflects net change (up / down / flat). */
function MiniSparkline({ color, values }: { color: string; values: number[] }) {
  const w = 80;
  const h = 32;
  const pad = 2;
  const vals = values.length >= 2 ? values : [0, 0];
  const max = Math.max(...vals, 0);
  const min = Math.min(...vals);
  const span = max - min;
  const flat = span === 0;
  const innerH = h - pad * 2;
  const midY = pad + innerH / 2;
  const d = vals
    .map((v, i) => {
      const x = pad + (i / (vals.length - 1)) * (w - pad * 2);
      const y = flat ? midY : pad + (1 - (v - min) / span) * innerH;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-8 w-[5rem] shrink-0"
      fill="none"
      aria-hidden
    >
      <path d={d} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const COHORT_SPARK_PICK: Record<
  "det" | "ie" | "sus" | "pos" | "neg",
  (row: BehaviourCohortDailyMetricRow) => number
> = {
  det: (r) => r.detentions,
  ie: (r) => r.internalExclusions,
  sus: (r) => r.suspensions,
  pos: (r) => r.positivePoints,
  neg: (r) => r.negativePoints,
};
function sectionHeader(title: string, subtitle?: string, titleExtras?: ReactNode) {
  return (
    <div className="px-5 py-4 sm:px-6 sm:py-5">
      <div className="flex flex-wrap items-center gap-2">
        {titleExtras}
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#6B7280]">{title}</p>
      </div>
      {subtitle ? (
        <p className="mt-1 max-w-2xl text-[0.8125rem] leading-relaxed text-[#6B7280]">{subtitle}</p>
      ) : null}
    </div>
  );
}

function KpiIconWell({
  bgClass,
  children,
}: {
  bgClass: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${bgClass}`}
    >
      {children}
    </div>
  );
}

const KPI_CARD_BASE =
  "anx-elevated-card flex gap-3 p-5 sm:gap-4 sm:p-6 bg-gradient-to-br from-[var(--surface-container-lowest)]";

function kpiCardTintClass(tint: "violet" | "green" | "amber" | "blue"): string {
  const t = {
    violet: "to-[rgba(124,92,255,0.07)]",
    green: "to-[rgba(34,197,94,0.08)]",
    amber: "to-[rgba(245,158,11,0.09)]",
    blue: "to-[rgba(59,130,246,0.08)]",
  }[tint];
  return `${KPI_CARD_BASE} ${t}`;
}

function StatCircleIcon({
  bg,
  stroke,
  children,
}: {
  bg: string;
  stroke: string;
  children: ReactNode;
}) {
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
      style={{ backgroundColor: bg, color: stroke }}
    >
      {children}
    </span>
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

function buildBehaviourHeatmapData(
  details: OnCallRequestDetail[],
  availableYearGroups: string[],
  selectedYearGroup?: string,
): { yearGroups: string[]; columnLabels: string[]; matrix: number[][] } | null {
  const columnLabels = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const baseYearGroups = selectedYearGroup
    ? [selectedYearGroup]
    : availableYearGroups.length > 0
      ? availableYearGroups
      : Array.from(new Set(details.map((detail) => detail.studentYearGroup).filter(Boolean) as string[]));

  if (baseYearGroups.length === 0) return null;

  const indexByYearGroup = new Map(baseYearGroups.map((yearGroup, index) => [yearGroup, index]));
  const matrix = baseYearGroups.map(() => [0, 0, 0, 0, 0]);

  for (const detail of details) {
    if (!detail.studentYearGroup) continue;
    const rowIndex = indexByYearGroup.get(detail.studentYearGroup);
    if (rowIndex === undefined) continue;
    const day = new Date(detail.createdAt).getDay();
    if (day < 1 || day > 5) continue;
    matrix[rowIndex][day - 1] += 1;
  }

  const filteredRows = baseYearGroups
    .map((yearGroup, index) => ({ yearGroup, row: matrix[index] }))
    .filter(({ row }) => selectedYearGroup || row.some((value) => value > 0));

  if (filteredRows.length === 0) return null;

  return {
    yearGroups: filteredRows.map(({ yearGroup }) => yearGroup),
    columnLabels,
    matrix: filteredRows.map(({ row }) => row),
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

  const secondaryStats = buildSecondaryStats(summary, labels, detentionPlural, internalExclusionPlural, suspensionPlural);
  const behaviourHeatmap = buildBehaviourHeatmapData(
    result.onCallRequestDetails,
    yearGroups,
    yearGroupFilter || undefined,
  );

  const secondaryVisual: Record<
    string,
    { circleBg: string; circleStroke: string; spark: string; icon: ReactNode }
  > = {
    det: {
      circleBg: "rgba(124,92,255,0.18)",
      circleStroke: "#7C5CFF",
      spark: "#7C5CFF",
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M6 12h12" />
        </svg>
      ),
    },
    ie: {
      circleBg: "rgba(245,158,11,0.2)",
      circleStroke: "#D97706",
      spark: "#F59E0B",
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M12 8v5M12 16h.01" />
        </svg>
      ),
    },
    sus: {
      circleBg: "rgba(236,72,153,0.16)",
      circleStroke: "#DB2777",
      spark: "#EC4899",
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M6 12h12" />
        </svg>
      ),
    },
    pos: {
      circleBg: "rgba(34,197,94,0.14)",
      circleStroke: "#15803d",
      spark: "#22c55e",
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 12l4 4 8-8" />
        </svg>
      ),
    },
    neg: {
      circleBg: "rgba(239,68,68,0.12)",
      circleStroke: "#dc2626",
      spark: "#ef4444",
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M8 12h8" />
        </svg>
      ),
    },
  };

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
          <div className="flex flex-wrap items-center gap-2">
            {showExport ? (
              <form action="/api/explorer/export" method="POST" className="inline">
                <input type="hidden" name="view" value="BEHAVIOUR_STUDENTS_TABLE" />
                <input type="hidden" name="windowDays" value={String(windowDays)} />
                {yearGroupFilter ? <input type="hidden" name="yearGroup" value={yearGroupFilter} /> : null}
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-[var(--surface-container-lowest)] px-4 py-2.5 text-[0.8125rem] font-semibold text-text shadow-sm calm-transition hover:bg-[#F9FAFB]"
                >
                  <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
                    <polyline points="7 10 12 15 17 10" strokeLinecap="round" strokeLinejoin="round" />
                    <line x1="12" y1="15" x2="12" y2="3" strokeLinecap="round" />
                  </svg>
                  Export
                </button>
              </form>
            ) : null}
            <a
              href="#behaviour-analysis-filters"
              className="inline-flex items-center gap-2 rounded-xl bg-[#0f172a] px-4 py-2.5 text-[0.8125rem] font-semibold text-white shadow-sm calm-transition hover:bg-[#1e293b] dark:bg-[#0f172a] dark:hover:bg-[#1e293b]"
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M4 21v-7M4 10v-3M4 3v3M10 21v-9M10 8V3M16 21v-5M16 12V3M22 21v-9M22 10V3" strokeLinecap="round" />
              </svg>
              Apply filters
            </a>
          </div>
        }
      />

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
        <div className={kpiCardTintClass("violet")}>
          <KpiIconWell bgClass="bg-[rgba(124,92,255,0.14)] text-[#7C5CFF]">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeLinecap="round" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" />
            </svg>
          </KpiIconWell>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#6B7280]">Cohort</p>
            <p className="mt-1 text-[2rem] font-bold leading-none tracking-tight text-text sm:text-[2.35rem] tabular-nums">
              {summary.totalStudents.toLocaleString()}
            </p>
            <p className="mt-1.5 text-[0.8125rem] text-[#6B7280]">Students in this filter</p>
          </div>
        </div>

        <div className={kpiCardTintClass("green")}>
          <KpiIconWell bgClass="bg-[rgba(34,197,94,0.12)] text-[#15803d]">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M3 17l6-6 4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M14 7h7v7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </KpiIconWell>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#6B7280]">Avg attendance</p>
            <p className="mt-1 text-[2rem] font-bold tabular-nums leading-none tracking-tight text-text sm:text-[2.35rem]">
              {summary.attendanceMean !== null ? `${summary.attendanceMean.toFixed(1)}%` : "—"}
            </p>
            <p className="mt-1.5 text-[0.8125rem] text-[#6B7280]">Mean on latest snapshot in window</p>
          </div>
        </div>

        <div className={kpiCardTintClass("amber")}>
          <KpiIconWell bgClass="bg-[rgba(245,158,11,0.18)] text-[#c2410c]">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 2l2.4 7.4h7.6l-6 4.6 2.3 7-6-4.6-6 4.6 2.3-7-6-4.6h7.6z" />
            </svg>
          </KpiIconWell>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#6B7280]">High priority</p>
            <p className="mt-1 text-[2rem] font-bold tabular-nums leading-none tracking-tight text-text sm:text-[2.35rem]">
              {summary.highPriorityCount}
            </p>
            <p className="mt-1.5 text-[0.8125rem] text-[#6B7280]">Urgent &amp; priority pastoral bands</p>
          </div>
        </div>

        <div className={kpiCardTintClass("blue")}>
          <KpiIconWell bgClass="bg-[rgba(59,130,246,0.14)] text-[#2563eb]">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </KpiIconWell>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#6B7280]">{onCallPlural} (imports)</p>
            <p className="mt-1 text-[2rem] font-bold tabular-nums leading-none tracking-tight text-text sm:text-[2.35rem]">
              {summary.totalOnCalls}
            </p>
            <p className="mt-1.5 text-[0.8125rem] text-[#6B7280]">Snapshot totals · not live requests</p>
          </div>
        </div>
      </div>

      {secondaryStats.length > 0 ? (
        <div>
          <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.1em] text-[#6B7280]">Sanctions &amp; points</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {secondaryStats.map((s) => {
              const vis = secondaryVisual[s.key];
              return (
                <div
                  key={s.key}
                  className="anx-elevated-card flex items-center gap-3 rounded-2xl px-4 py-3.5"
                >
                  {vis ? (
                    <StatCircleIcon bg={vis.circleBg} stroke={vis.circleStroke}>
                      {vis.icon}
                    </StatCircleIcon>
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#6B7280]">{s.label}</p>
                    <p
                      className={`mt-0.5 text-xl font-bold tabular-nums tracking-tight text-[#111827] ${s.valueClass ?? ""}`}
                    >
                      {s.value}
                    </p>
                  </div>
                  {vis && s.key in COHORT_SPARK_PICK ? (
                    <MiniSparkline
                      color={vis.spark}
                      values={result.cohortDailyMetrics.map(COHORT_SPARK_PICK[s.key as keyof typeof COHORT_SPARK_PICK])}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

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

      <div id="behaviour-heatmap" className="anx-elevated-card overflow-hidden rounded-2xl scroll-mt-24">
        {sectionHeader(
          "Behaviour heatmap",
          "Weekday pattern of on-call incidents by year group for the selected window.",
        )}
        <div className="border-t border-[rgba(15,23,42,0.06)] px-5 py-5 sm:px-6 sm:py-6">
          {!hasOnCallFeature ? (
            <p className="text-sm leading-relaxed text-[#6B7280]">
              On-call workflow is not enabled for this school, so the live behaviour heatmap is unavailable.
            </p>
          ) : behaviourHeatmap ? (
            <BehaviourHeatmap
              yearGroups={behaviourHeatmap.yearGroups}
              columnLabels={behaviourHeatmap.columnLabels}
              matrix={behaviourHeatmap.matrix}
              subtitle="Weekday distribution for the current filters"
              hideCta
            />
          ) : (
            <p className="text-sm leading-relaxed text-[#6B7280]">
              No on-call incidents matched the current filters in this window.
            </p>
          )}
        </div>
      </div>

      {/* Live on-call: charts (left) + frequent requesters (right) */}
      <div className="anx-elevated-card overflow-hidden rounded-2xl">
        {sectionHeader(
          `${onCallPlural} · live`,
          "Requests in this window. Charts use school hours 8am–3pm. Tap a bar to open details.",
          <span className="inline-flex h-2 w-2 shrink-0 rounded-full bg-[#22c55e]" title="Live data" aria-hidden />,
        )}

        {!hasOnCallFeature ? (
          <div className="border-t border-[rgba(15,23,42,0.06)] px-5 py-6 sm:px-6">
            <p className="text-sm leading-relaxed text-[#6B7280]">
              On-call workflow is not enabled for this school. Enable the feature to see timing and teacher breakdowns;
              imported snapshots still include on-call counts in the overview above.
            </p>
          </div>
        ) : (
          <div className="border-t border-[rgba(15,23,42,0.06)]">
            <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(280px,380px)] lg:divide-x lg:divide-[rgba(15,23,42,0.06)]">
              <div className="min-w-0">
                <OnCallBreakdownCharts
                  onCallByHour={result.onCallByHour}
                  onCallByReason={result.onCallByReason}
                  details={result.onCallRequestDetails}
                  compact
                />
              </div>

              <aside className="flex flex-col border-t border-[rgba(15,23,42,0.06)] bg-[rgba(124,92,255,0.02)] p-5 sm:p-6 lg:border-t-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#6B7280]">Most frequent requesters</p>
                <p className="mt-1 text-[0.8125rem] leading-relaxed text-[#6B7280]">
                  Teachers raising the most on-call requests in this window.
                </p>
                <div className="mt-5 flex-1">
                  {topTeachers.length > 0 ? (
                    <div className="anx-elevated-card--table table-shell overflow-hidden rounded-xl border border-[#E5E7EB] bg-[var(--surface-container-lowest)]">
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
                                    <span className="font-medium text-[#111827]">{row.teacherName}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3.5 text-right tabular-nums text-[#6B7280]">{row.count}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-[#6B7280]">No on-call requests for this cohort in the window.</p>
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
          <span className="inline-flex items-center rounded-md bg-[#F3E8FF] px-2.5 py-1 text-[11px] font-semibold text-[#6B21A8]">
            {suspensionStudentCount} student{suspensionStudentCount === 1 ? "" : "s"}
          </span>
        }
        icon={
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#F3E8FF] text-[#6B21A8]">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" aria-hidden>
              <path d="M6 12h12" />
            </svg>
          </span>
        }
      >
        {result.suspensionIncidents.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm text-[#666666]">No suspensions on the latest snapshot for this cohort.</p>
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
                              className="truncate font-medium text-[#333333] underline decoration-[#d1d5db] underline-offset-2 calm-transition hover:text-[#111827] hover:decoration-[#9ca3af]"
                            >
                              {row.studentName}
                            </Link>
                          </div>
                        </td>
                        <td className="text-[#666666]">{row.yearGroup ?? "—"}</td>
                        <td className="text-right tabular-nums text-[#666666]">{row.suspensionsCount}</td>
                        <td className="tabular-nums text-[#666666]">{fmtSnapshotDate(row.snapshotDate)}</td>
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
              className="text-[#666666] underline decoration-[#d1d5db] underline-offset-2 calm-transition hover:text-[#333333]"
            >
              Explorer
            </Link>{" "}
            → Students).
          </>
        }
        countPill={
          <span className="inline-flex items-center rounded-md bg-[#FFF7ED] px-2.5 py-1 text-[11px] font-semibold text-[#9A3412]">
            {result.highPriorityStudents.length} student{result.highPriorityStudents.length === 1 ? "" : "s"}
          </span>
        }
        icon={
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#FFF7ED] text-[#9A3412]">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 2l2.4 7.4h7.6l-6 4.6 2.3 7-6-4.6-6 4.6 2.3-7-6-4.6h7.6z" />
            </svg>
          </span>
        }
      >
        {result.highPriorityStudents.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-14">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-md bg-[#FFF7ED]">
              <svg className="h-6 w-6 text-[#9A3412]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <circle cx="11" cy="11" r="6.5" />
                <path d="m16.5 16.5 3 3" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-[0.875rem] font-semibold text-[#333333]">No students in urgent or priority bands</p>
            <p className="mt-1 max-w-sm text-center text-[0.8125rem] text-[#666666]">
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
                              className="truncate font-medium text-[#333333] underline decoration-[#d1d5db] underline-offset-2 calm-transition hover:text-[#111827] hover:decoration-[#9ca3af]"
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
                        <td className="text-[#666666]">{student.yearGroup ?? "—"}</td>
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
                        <td className="text-right tabular-nums text-[#666666]">
                          {student.attendancePct !== null ? `${student.attendancePct.toFixed(1)}%` : "—"}
                        </td>
                        <td className="text-right tabular-nums text-[#666666]">{student.detentionsCount}</td>
                        <td className="text-right tabular-nums text-[#666666]">{student.internalExclusionsCount}</td>
                        <td className="text-right tabular-nums text-[#666666]">{student.onCallsCount}</td>
                        {summary.hasPositivePoints ? (
                          <td className="text-right text-sm font-bold tabular-nums text-[#166534]">
                            {student.positivePointsTotal}
                          </td>
                        ) : null}
                        {summary.hasNegativePoints ? (
                          <td className="text-right tabular-nums text-[#666666]">{student.negativePointsTotal}</td>
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
