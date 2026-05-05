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
import {
  computeBehaviourAnalysis,
  type BehaviourAnalysisSummary,
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

/** Decorative sparkline derived deterministically from totals (no time-series on this page). */
function sparkSeries(seed: string, peak: number): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const n = 12;
  const out: number[] = [];
  const mag = Math.max(Math.log10(peak + 10) * 12, 8);
  for (let i = 0; i < n; i++) {
    const noise = ((h >> (i % 16)) & 0xff) / 255;
    const trend = i / (n - 1);
    out.push(mag * (0.35 + noise * 0.45 + trend * 0.35));
  }
  return out;
}

function MiniSparkline({ color, seed, peak }: { color: string; seed: string; peak: number }) {
  const vals = sparkSeries(seed, peak);
  const w = 80;
  const h = 32;
  const max = Math.max(...vals, 1e-6);
  const min = Math.min(...vals);
  const span = max - min || 1;
  const pad = 2;
  const d = vals
    .map((v, i) => {
      const x = pad + (i / (vals.length - 1)) * (w - pad * 2);
      const y = pad + (1 - (v - min) / span) * (h - pad * 2);
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
      <path d={d} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function sectionHeader(title: string, subtitle?: string, titleExtras?: ReactNode) {
  return (
    <div className="px-5 py-4 sm:px-6 sm:py-5">
      <div className="flex flex-wrap items-center gap-2">
        {titleExtras}
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted">{title}</p>
      </div>
      {subtitle ? (
        <p className="mt-1 max-w-2xl text-[0.8125rem] leading-relaxed text-muted">{subtitle}</p>
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
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
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

  const secondaryVisual: Record<
    string,
    { circleBg: string; circleStroke: string; spark: string; icon: ReactNode }
  > = {
    det: {
      circleBg: "rgba(124,105,239,0.18)",
      circleStroke: "#7C69EF",
      spark: "#7C69EF",
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
                  className="inline-flex items-center gap-2 rounded-xl border border-border/45 bg-background px-4 py-2.5 text-[0.8125rem] font-semibold text-text shadow-sm calm-transition hover:bg-surface-container-low"
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
              className="inline-flex items-center gap-2 rounded-xl bg-neutral-950 px-4 py-2.5 text-[0.8125rem] font-semibold text-white shadow-sm calm-transition hover:bg-neutral-900 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100"
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
      <div className="rounded-xl border border-border/30 bg-background p-5 shadow-[0_2px_16px_rgba(15,23,42,0.05)] sm:p-6">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          <div className="flex gap-3 sm:gap-4">
            <KpiIconWell bgClass="bg-[rgba(124,105,239,0.14)] text-[#7C69EF]">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeLinecap="round" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" />
              </svg>
            </KpiIconWell>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted">Cohort</p>
              <p className="mt-1 text-[2rem] font-bold leading-none tracking-tight text-text sm:text-[2.35rem] tabular-nums">
                {summary.totalStudents.toLocaleString()}
              </p>
              <p className="mt-1.5 text-[0.8125rem] text-muted">Students in this filter</p>
            </div>
          </div>

          <div className="flex gap-3 sm:gap-4">
            <KpiIconWell bgClass="bg-[rgba(34,197,94,0.12)] text-[#15803d]">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M3 17l6-6 4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M14 7h7v7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </KpiIconWell>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted">Avg attendance</p>
              <p className="mt-1 text-[2rem] font-bold tabular-nums leading-none tracking-tight text-text sm:text-[2.35rem]">
                {summary.attendanceMean !== null ? `${summary.attendanceMean.toFixed(1)}%` : "—"}
              </p>
              <p className="mt-1.5 text-[0.8125rem] text-muted">Mean on latest snapshot in window</p>
            </div>
          </div>

          <div className="flex gap-3 sm:gap-4">
            <KpiIconWell bgClass="bg-[rgba(245,158,11,0.18)] text-[#c2410c]">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 2l2.4 7.4h7.6l-6 4.6 2.3 7-6-4.6-6 4.6 2.3-7-6-4.6h7.6z" />
              </svg>
            </KpiIconWell>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted">High priority</p>
              <p className="mt-1 text-[2rem] font-bold tabular-nums leading-none tracking-tight text-text sm:text-[2.35rem]">
                {summary.highPriorityCount}
              </p>
              <p className="mt-1.5 text-[0.8125rem] text-muted">Urgent &amp; priority pastoral bands</p>
            </div>
          </div>

          <div className="flex gap-3 sm:gap-4">
            <KpiIconWell bgClass="bg-[rgba(59,130,246,0.14)] text-[#2563eb]">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </KpiIconWell>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted">{onCallPlural} (imports)</p>
              <p className="mt-1 text-[2rem] font-bold tabular-nums leading-none tracking-tight text-text sm:text-[2.35rem]">
                {summary.totalOnCalls}
              </p>
              <p className="mt-1.5 text-[0.8125rem] text-muted">Snapshot totals · not live requests</p>
            </div>
          </div>
        </div>

        {secondaryStats.length > 0 ? (
          <>
            <div className="my-8 border-t border-border/20" />
            <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.1em] text-muted">Sanctions &amp; points</p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {secondaryStats.map((s) => {
                const vis = secondaryVisual[s.key];
                const numeric =
                  typeof s.value === "string" || typeof s.value === "number"
                    ? Number(String(s.value).replace(/,/g, ""))
                    : 0;
                return (
                  <div
                    key={s.key}
                    className="flex items-center gap-3 rounded-xl border border-border/25 bg-background px-4 py-3.5 shadow-sm"
                  >
                    {vis ? (
                      <StatCircleIcon bg={vis.circleBg} stroke={vis.circleStroke}>
                        {vis.icon}
                      </StatCircleIcon>
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">{s.label}</p>
                      <p
                        className={`mt-0.5 text-xl font-bold tabular-nums tracking-tight text-text ${s.valueClass ?? ""}`}
                      >
                        {s.value}
                      </p>
                    </div>
                    {vis ? (
                      <MiniSparkline color={vis.spark} seed={s.key + String(s.value)} peak={numeric} />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </>
        ) : null}
      </div>

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

      {/* Live on-call + requesters */}
      <div className="overflow-hidden rounded-xl border border-border/30 bg-background shadow-[0_2px_16px_rgba(15,23,42,0.05)]">
        {sectionHeader(
          `${onCallPlural} · live`,
          "Requests in this window. Charts use school hours 8am–3pm. Use bars to open details.",
          <span className="inline-flex h-2 w-2 shrink-0 rounded-full bg-[#22c55e]" title="Live data" aria-hidden />,
        )}

        {!hasOnCallFeature ? (
          <div className="border-t border-border/20 px-5 py-6 sm:px-6">
            <p className="text-sm leading-relaxed text-muted">
              On-call workflow is not enabled for this school. Enable the feature to see timing and teacher breakdowns;
              imported snapshots still include on-call counts in the overview above.
            </p>
          </div>
        ) : (
          <>
            <div className="border-t border-border/20">
              <OnCallBreakdownCharts
                onCallByHour={result.onCallByHour}
                onCallByReason={result.onCallByReason}
                details={result.onCallRequestDetails}
              />
            </div>

            <div className="border-t border-border/20 px-5 py-6 sm:px-6">
              <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.1em] text-muted">Most frequent requesters</p>
              {topTeachers.length > 0 ? (
                <div className="table-shell overflow-hidden rounded-xl border border-border/25">
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
                        {topTeachers.map((row, i) => (
                          <tr
                            key={row.teacherId}
                            className="calm-transition"
                          >
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
          </>
        )}
      </div>

      {/* Suspensions */}
      <BehaviourAnalysisCollapsibleSection
        title={suspensionPlural}
        subtitle={`Students with at least one suspension on their latest snapshot (${summary.totalSuspensions.toLocaleString()} total on those records).`}
        countPill={
          <span className="inline-flex items-center rounded-full bg-[rgba(124,105,239,0.14)] px-2.5 py-1 text-[11px] font-semibold text-[#5b4bd6] ring-1 ring-inset ring-[rgba(124,105,239,0.25)]">
            {suspensionStudentCount} student{suspensionStudentCount === 1 ? "" : "s"}
          </span>
        }
        icon={
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(124,105,239,0.18)] text-[#7C69EF]">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M6 12h12" />
            </svg>
          </span>
        }
      >
        {result.suspensionIncidents.length === 0 ? (
          <div className="px-5 py-10 text-center sm:px-6">
            <p className="text-sm text-muted">No suspensions on the latest snapshot for this cohort.</p>
          </div>
        ) : (
          <div className="p-4 sm:p-5 sm:pt-4">
            <div className="table-shell overflow-hidden rounded-xl border border-border/25">
              <p className="sr-only" id="explorer-analysis-suspensions-scroll-hint">
                This table scrolls horizontally on small screens. Use touch or trackpad to see all columns.
              </p>
              <div className="overflow-x-auto" aria-describedby="explorer-analysis-suspensions-scroll-hint">
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
                    {result.suspensionIncidents.map((row, i) => (
                      <tr
                        key={`${row.studentId}-${row.snapshotDate.toISOString()}`}
                        className="calm-transition"
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <Avatar name={row.studentName} size="sm" />
                            <Link href={`/students/${row.studentId}`} className="truncate underline decoration-border/60 underline-offset-2 calm-transition hover:text-accent hover:decoration-accent">
                              {row.studentName}
                            </Link>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-muted">{row.yearGroup ?? "—"}</td>
                        <td className="px-4 py-3.5 text-right tabular-nums text-muted">{row.suspensionsCount}</td>
                        <td className="px-4 py-3.5 tabular-nums text-muted">{fmtSnapshotDate(row.snapshotDate)}</td>
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
            <Link href="/explorer/students" className="text-muted underline decoration-border/50 underline-offset-2 calm-transition hover:text-text">
              Explorer
            </Link>{" "}
            → Students).
          </>
        }
        countPill={
          <span className="inline-flex items-center rounded-full bg-[rgba(245,158,11,0.18)] px-2.5 py-1 text-[11px] font-semibold text-[#c2410c] ring-1 ring-inset ring-[rgba(245,158,11,0.35)]">
            {result.highPriorityStudents.length} student{result.highPriorityStudents.length === 1 ? "" : "s"}
          </span>
        }
        icon={
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[rgba(245,158,11,0.2)] text-[#ea580c]">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 2l2.4 7.4h7.6l-6 4.6 2.3 7-6-4.6-6 4.6 2.3-7-6-4.6h7.6z" />
            </svg>
          </span>
        }
      >
        {result.highPriorityStudents.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-5 py-14 sm:px-6">
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
          <div className="p-4 sm:p-5 sm:pt-4">
            <div className="table-shell overflow-hidden rounded-xl border border-border/25">
              <p className="sr-only" id="explorer-analysis-high-priority-scroll-hint">
                This table scrolls horizontally on small screens. Use touch or trackpad to see all columns.
              </p>
              <div className="overflow-x-auto" aria-describedby="explorer-analysis-high-priority-scroll-hint">
                <table className="w-full min-w-[720px] text-sm">
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
                      {summary.hasPositivePoints ? (
                        <th className="px-4 py-3 text-right">{labels.positivePoints}</th>
                      ) : null}
                      {summary.hasNegativePoints ? (
                        <th className="px-4 py-3 text-right">{labels.negativePoints}</th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {result.highPriorityStudents.map((student, i) => (
                      <tr
                        key={student.studentId}
                        className="calm-transition"
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <Avatar name={student.studentName} size="sm" />
                            <Link
                              href={`/analysis/students/${student.studentId}?window=${windowDays}`}
                              className="truncate underline decoration-border/60 underline-offset-2 calm-transition hover:text-accent hover:decoration-accent"
                            >
                              {student.studentName}
                            </Link>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <StatusPill variant={student.band === "URGENT" ? "error" : "warning"} size="sm">
                            {student.band === "URGENT" ? "Urgent" : "Priority"}
                          </StatusPill>
                        </td>
                        <td className="px-4 py-3.5 text-muted">{student.yearGroup ?? "—"}</td>
                        <td className="px-4 py-3.5">
                          <div className="flex flex-wrap gap-1.5">
                            {student.ppFlag ? (
                              <StatusPill variant="info" size="sm">
                                PP
                              </StatusPill>
                            ) : null}
                            {student.sendFlag ? (
                              <StatusPill variant="warning" size="sm">
                                SEND
                              </StatusPill>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums text-muted">
                          {student.attendancePct !== null ? `${student.attendancePct.toFixed(1)}%` : "—"}
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums text-muted">{student.detentionsCount}</td>
                        <td className="px-4 py-3.5 text-right tabular-nums text-muted">{student.internalExclusionsCount}</td>
                        <td className="px-4 py-3.5 text-right tabular-nums text-muted">{student.onCallsCount}</td>
                        {summary.hasPositivePoints ? (
                          <td className="px-4 py-3.5 text-right text-sm font-bold tabular-nums text-[var(--scale-strong-text)]">
                            {student.positivePointsTotal}
                          </td>
                        ) : null}
                        {summary.hasNegativePoints ? (
                          <td className="px-4 py-3.5 text-right tabular-nums text-muted">{student.negativePointsTotal}</td>
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
