"use client";

/**
 * Result Point Detail — Single-Point Analysis
 *
 * Shows comprehensive attainment analysis for one result point.
 * Adapts to GCSE (numeric 1-9) vs A-Level (A*-U) dominant format.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { SectionHeader } from "@/components/ui/section-header";
import Link from "next/link";
import { DataTableEmpty } from "@/components/ui/data-table-empty";
import { AssessmentsBreadcrumb } from "@/components/assessments/assessments-chrome";
import type { GradeFormat, PointType, ResultStatus } from "@prisma/client";
import { aLevelLetterCellClass, gcseNumericCellClass } from "@/lib/assessments/chartColours";
import {
  aLevelBarClasses,
  barNegativeClass,
  barNeutralClass,
  barPositiveClass,
  finalPointChipClass,
  gcseGradeBadgeClass,
  gradeDistributionBarStyle,
  metPillClass,
  notMetPillClass,
  pctBandBarStyle,
  pointTypePillClasses,
  ppInlineBadgeClass,
  ppInlineBadgeClassLg,
  ppNumericClass,
  sendInlineBadgeClass,
  sendInlineBadgeClassLg,
  sendNumericClass,
  swatchHighClass,
  swatchLowClass,
  swatchMidClass,
  aLevelGradeBadgeClass,
  pctScoreBadgeClass,
  gapBadgeClass,
  thresholdHeaderALevel,
  thresholdHeaderGcse,
  resultStatusPillClasses,
  emProgressFillClass,
} from "@/modules/assessments/attainmentColours";

// ─── Types ────────────────────────────────────────────────────────────────────

type StudentResult = { studentId: string; name: string; score: number | null; rawValue: string };
type EMStudentResult = { studentId: string; name: string; engScore: number | null; mathScore: number | null; engRaw: string; mathRaw: string; met: boolean };

type SubjectMeasure = {
  subject: string;
  assessmentId: string;
  gradeFormat: GradeFormat;
  total: number;
  presentCount: number;
  thresholds: Record<string, number>;
  pp: {
    count: number; t4: number; t5: number;
    nonPpT4: number; nonPpT5: number; gap4: number; gap5: number;
  } | null;
  send: { count: number; t4: number; t5: number; nonSendT4: number; nonSendT5: number; gap4: number; gap5: number } | null;
  distribution: Array<{ grade: string; count: number }>;
  students: StudentResult[];
};

type GcseBasics = {
  em4: number; em5: number; em7: number;
  ppEm4: number; ppEm5: number; nonPpEm4: number; nonPpEm5: number;
  gap4: number; gap5: number;
  sendEm4: number; sendEm5: number; nonSendEm4: number; nonSendEm5: number;
  sendGap4: number; sendGap5: number;
  students4: EMStudentResult[];
  students5: EMStudentResult[];
  students7: EMStudentResult[];
};

type ModalView =
  | { type: 'EM', label: string, students: EMStudentResult[], target: number }
  | { type: 'GRADE', subject: string; grade: string; gradeFormat: GradeFormat; students: StudentResult[] }
  | null;

type ALevelSummary = {
  total: number; aStarPct: number; aPct: number; bPct: number; cPlusPct: number;
};

// ─── Percentage analysis types ────────────────────────────────────────────────

type BandCount = { band: string; from: number; to: number; count: number; pct: number };
type PctStudentResult = { studentId: string; name: string; ppFlag: boolean; sendFlag: boolean; score: number; rank: number };
type TeachingGroupStat = { group: string; count: number; mean: number; vsYearMean: number };
type PctSubjectStat = {
  subject: string;
  assessmentId: string;
  presentCount: number;
  mean: number;
  median: number;
  q1: number;
  q3: number;
  distribution: BandCount[];
  ppMean: number | null;
  nonPpMean: number | null;
  ppGap: number | null;
  sendMean: number | null;
  nonSendMean: number | null;
  sendGap: number | null;
  teachingGroups: TeachingGroupStat[];
  topStudents: PctStudentResult[];
  bottomStudents: PctStudentResult[];
};
type OverallRankEntry = { studentId: string; name: string; ppFlag: boolean; sendFlag: boolean; overallMean: number; rank: number; subjectCount: number };
type PercentageSummary = {
  pointId: string;
  gradeFormat: string;
  yearMean: number;
  distribution: BandCount[];
  subjects: PctSubjectStat[];
  overallTop: OverallRankEntry[];
  overallBottom: OverallRankEntry[];
};

type PointData = {
  id: string;
  label: string;
  pointType: PointType;
  resultStatus: ResultStatus;
  isFinalPoint: boolean;
  cycle: { id: string; label: string; qualificationType: string };
};

type MetricsData = {
  dominantFormat: GradeFormat;
  totalStudents: number;
  totalEntries: number;
  subjects: SubjectMeasure[];
  gcseBasics: GcseBasics | null;
  aLevelSummary: ALevelSummary | null;
};

// ─── KPI Icon Components ──────────────────────────────────────────────────────

function IconUsersKpi() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconClipboardKpi() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <path d="M9 12h6M9 16h4" />
    </svg>
  );
}

function IconBookOpenKpi() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

const kpiIconCircleViolet = "inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent)]";
const kpiIconCircleBlue = "inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--info)_12%,transparent)] text-[var(--info)]";
const kpiIconCircleGreen = "inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--success)_12%,transparent)] text-[var(--success)]";

function SubjectIcon({ subject }: { subject: string }) {
  const s = subject.toLowerCase();
  const paths = (() => {
    if (s.includes("geog")) return (<><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></>);
    if (s.includes("phys")) return (<><circle cx="12" cy="12" r="3" /><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" /></>);
    if (s.includes("chem")) return (<><path d="M9 3H5a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-4z" /><path d="M3 15h12M9 3v4" /></>);
    if (s.includes("bio")) return (<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></>);
    if (s.includes("stat") || s.includes("math")) return (<><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>);
    if (s.includes("socio") || s.includes("psych") || s.includes("hist") || s.includes("poli")) return (<><circle cx="12" cy="8" r="4" /><path d="M8 16h8M10 20h4" /></>);
    if (s.includes("french") || s.includes("spanish") || s.includes("german") || s.includes("language") || s.includes("mfl")) return (<><path d="M5 8l6 6M4 14l6-6 2-3" /><path d="M2 5h12M7 2h1M17 14l-5 5M13 19l5-5" /><path d="M15 13h6M18 10v1" /></>);
    if (s.includes("re") || s.includes("relig")) return (<><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></>);
    if (s.includes("music") || s.includes("drama") || s.includes("art") || s.includes("theatre")) return (<><circle cx="5.5" cy="17.5" r="2.5" /><circle cx="17.5" cy="15.5" r="2.5" /><polyline points="8 17 8 5 20 3 20 15" /><line x1="8" y1="11" x2="20" y2="9" /></>);
    if (s.includes("comput") || s.includes("it") || s.includes("digital")) return (<><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></>);
    if (s.includes("english") || s.includes("lit")) return (<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></>);
    return (<><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></>);
  })();
  return (
    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface-container)] text-[var(--on-surface-muted)]">
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>{paths}</svg>
    </span>
  );
}

// ─── Colour helpers ───────────────────────────────────────────────────────────

function gapCls(gap: number) {
  if (gap <= 5) return "text-[var(--success)]";
  if (gap <= 15) return "text-[var(--warning)]";
  return "text-[var(--error)]";
}

function GapBadge({ gap }: { gap: number }) {
  return (
    <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[11px] font-bold tabular-nums ${gapBadgeClass(gap)}`}>
      {gap > 0 ? "+" : ""}{gap}pp
    </span>
  );
}

function DistBar({ distribution, format, onGradeClick }: { distribution: Array<{ grade: string; count: number }>; format: GradeFormat; onGradeClick?: (grade: string) => void }) {
  const total = distribution.reduce((s, d) => s + d.count, 0);
  if (total === 0) return <span className="text-xs text-[var(--on-surface-muted)]">No data</span>;
  return (
    <div className="space-y-1">
      <div className="flex h-5 gap-0.5 overflow-hidden rounded">
        {distribution.map((d) => {
          if (d.count === 0) return null;
          const pct = (d.count / total) * 100;
          const { bar } = gradeDistributionBarStyle(d.grade, format === "GCSE" ? "GCSE" : "A_LEVEL");
          return (
            <div key={d.grade} className={`flex items-center justify-center text-[9px] font-bold ${bar} ${onGradeClick ? 'cursor-pointer hover:opacity-80' : ''}`}
                 style={{ width: `${pct}%` }} title={`${d.grade}: ${d.count} (${Math.round(pct)}%)`}
                 onClick={() => onGradeClick && onGradeClick(d.grade)}>
              {pct > 7 && d.grade}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-2 gap-y-0.5">
        {distribution.filter((d) => d.count > 0).map((d) => {
          const pct = Math.round((d.count / total) * 100);
          const { swatch } = gradeDistributionBarStyle(d.grade, format === "GCSE" ? "GCSE" : "A_LEVEL");
          return (
            <button type="button" key={d.grade} className={`flex items-center gap-1 text-[9px] text-[var(--on-surface-muted)] ${onGradeClick ? 'hover:text-[var(--on-surface)] cursor-pointer' : ''}`}
                    onClick={() => onGradeClick && onGradeClick(d.grade)}>
              <span className={`inline-block h-2 w-2 rounded-sm ${swatch}`} />
              {d.grade}: {d.count} ({pct}%)
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Stacked bar + legend swatch for each 10% band (same as subject detail page). */
function pctBandDistributionStyle(from: number, to: number): { bar: string; swatch: string } {
  return pctBandBarStyle(from, to);
}

/** Compact 10% band distribution for percentage/raw rows (matches subject detail page). */
function PctDistCompact({ distribution }: { distribution: BandCount[] }) {
  const total = distribution.reduce((s, d) => s + d.count, 0);
  if (total === 0) return <span className="text-xs text-[var(--on-surface-muted)]">No data</span>;

  const thresholds = [80, 70, 60, 50].map((t) => {
    const count = distribution.filter((b) => b.from >= t).reduce((s, b) => s + b.count, 0);
    return { label: `${t}%+`, count, pct: Math.round((count / total) * 100) };
  });

  return (
    <div className="w-full min-w-[220px] space-y-1">
      <div className="flex h-5 w-full min-w-0 gap-0.5 overflow-hidden rounded">
        {distribution.map((d) => {
          if (d.count === 0) return null;
          const pct = (d.count / total) * 100;
          const { bar } = pctBandDistributionStyle(d.from, d.to);
          return (
            <div
              key={d.band}
              className={`flex items-center justify-center text-[8px] font-bold ${bar}`}
              style={{ width: `${pct}%` }}
              title={`${d.band}: ${d.count} (${Math.round(pct)}%)`}
            >
              {pct > 7 && `${d.from}%`}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-2 gap-y-0.5">
        {distribution
          .filter((d) => d.count > 0)
          .map((d) => {
            const pct = Math.round((d.count / total) * 100);
            const { swatch } = pctBandDistributionStyle(d.from, d.to);
            return (
              <span key={d.band} className="flex items-center gap-1 text-[9px] text-[var(--on-surface-muted)]">
                <span className={`inline-block h-2 w-2 shrink-0 rounded-sm ${swatch}`} />
                {d.band}: {d.count} ({pct}%)
              </span>
            );
          })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 border-t border-[var(--outline-variant)]/15 pt-1">
        {thresholds.map(({ label, count, pct }) => (
          <span key={label} className="text-[9px] text-[var(--on-surface-muted)]">
            <span className="font-bold uppercase tracking-wide">{label}</span>{" "}
            <span className="font-semibold tabular-nums text-[var(--on-surface)]">{pct}%</span>
            <span className="tabular-nums"> ({count})</span>
          </span>
        ))}
      </div>
    </div>
  );
}

const POINT_TYPE_COLOURS = pointTypePillClasses;
const RESULT_STATUS_BADGE = resultStatusPillClasses;

const POINT_TYPE_LABELS: Record<string, string> = {
  BASELINE: "Baseline", INTERNAL_ASSESSMENT: "Internal Assessment",
  INTERNAL_MOCK: "Internal Mock", TEACHER_PREDICTION: "Teacher Prediction",
  EXTERNAL_FINAL: "External Final", OTHER: "Other",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft", VALIDATED: "Validated", PUBLISHED: "Published", LOCKED: "Locked",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ResultPointPage() {
  const { cycleId, pointId } = useParams<{ cycleId: string; pointId: string }>();

  const [point, setPoint] = useState<PointData | null>(null);
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [pctSummary, setPctSummary] = useState<PercentageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalView, setModalView] = useState<ModalView>(null);
  const [expandedPctSubject, setExpandedPctSubject] = useState<string | null>(null);
  const [gcseGapView, setGcseGapView] = useState<"pp" | "send">("pp");
  const [gapView, setGapView] = useState<"pp" | "send">("pp");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [ptRes, mRes] = await Promise.all([
          fetch(`/api/assessments/points/${pointId}`),
          fetch(`/api/assessments/metrics?pointId=${pointId}`),
        ]);
        if (ptRes.ok) { const { point: p } = await ptRes.json(); setPoint(p); }
        if (mRes.ok) {
          const m = await mRes.json();
          setMetrics(m);
          // Fetch percentage analysis when applicable
          if (m.dominantFormat === "PERCENTAGE" || m.dominantFormat === "RAW") {
            const pctRes = await fetch(`/api/assessments/metrics/percentage?pointId=${pointId}`);
            if (pctRes.ok) setPctSummary(await pctRes.json());
          }
        } else { setError("Failed to load metrics."); }
      } catch { setError("Failed to load data."); }
      finally { setLoading(false); }
    }
    load();
  }, [pointId]);

  const isGcse = metrics?.dominantFormat === "GCSE";
  const isALevel = metrics?.dominantFormat === "A_LEVEL";
  const isPercentage = metrics?.dominantFormat === "PERCENTAGE" || metrics?.dominantFormat === "RAW";

  const pctYearHistogram = useMemo(() => {
    if (!pctSummary?.distribution.length) return null;
    const total = pctSummary.distribution.reduce((s, b) => s + b.count, 0);
    const maxBand = Math.max(...pctSummary.distribution.map((x) => x.count), 1);
    const below40 = pctSummary.distribution.filter((b) => b.to <= 40).reduce((s, b) => s + b.count, 0);
    const band4070 = pctSummary.distribution
      .filter((b) => b.from >= 40 && b.to <= 70)
      .reduce((s, b) => s + b.count, 0);
    const band70p = pctSummary.distribution.filter((b) => b.from >= 70).reduce((s, b) => s + b.count, 0);
    return { total, maxBand, below40, band4070, band70p };
  }, [pctSummary]);

  if (loading) {
    return <div className="w-full py-16 text-center text-sm text-[var(--on-surface-muted)]">Loading…</div>;
  }

  // Build meta badges for PageHeader
  const metaBadges = point ? (
    <div className="flex items-center gap-2 flex-wrap">
      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${POINT_TYPE_COLOURS[point.pointType]}`}>
        {POINT_TYPE_LABELS[point.pointType]}
      </span>
      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${RESULT_STATUS_BADGE[point.resultStatus] ?? "bg-surface-container-high text-on-surface-variant"}`}>
        {STATUS_LABELS[point.resultStatus]}
      </span>
      {point.isFinalPoint && (
        <span className={finalPointChipClass}>
          Final
        </span>
      )}
    </div>
  ) : null;

  const headerActions = point ? (
    <>
      {point.resultStatus !== "LOCKED" && (
        <Link
          href={`/assessments/${cycleId}/points/${pointId}/upload`}
          className="rounded-lg border border-[var(--outline-variant)] px-3 py-1.5 text-sm text-[var(--on-surface)] calm-transition hover:bg-[var(--surface-container-low)]"
        >
          Upload results
        </Link>
      )}
      <Link
        href={`/assessments/${cycleId}/compare?from=${pointId}`}
        className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white calm-transition hover:opacity-90"
      >
        Compare →
      </Link>
    </>
  ) : null;

  return (
    <div className="anx-reports-page w-full space-y-8">
      <AssessmentsBreadcrumb
        items={[
          { label: "Attainment", href: "/assessments" },
          { label: point?.cycle.label ?? "Cycle", href: `/assessments/${cycleId}` },
          { label: point?.label ?? "Result point" },
        ]}
      />

      {/* Page Header */}
      <PageHeader variant="ledger"
        eyebrow="Result point"
        title={point?.label ?? "Result point"}
        subtitle="Analysis for all uploaded subjects at this snapshot."
        meta={metaBadges}
        actions={headerActions}
      />

      {error && <p className="text-sm text-[var(--error)]">{error}</p>}

      {metrics && metrics.totalEntries === 0 && (
        <Card className="overflow-hidden p-0">
          <DataTableEmpty
            title="No results uploaded yet"
            description="Upload a CSV for one or more subjects to unlock distributions, E&M measures, and comparisons."
            action={
              point?.resultStatus !== "LOCKED" ? (
                <Link
                  href={`/assessments/${cycleId}/points/${pointId}/upload`}
                  className="link-accent text-sm font-semibold underline-offset-2"
                >
                  Upload subject results
                </Link>
              ) : undefined
            }
          />
        </Card>
      )}

      {metrics && metrics.totalEntries > 0 && (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-5">
            <StatCard layout="kpi" tone="glass" accentPlacement="none" label="Students Assessed" value={metrics.totalStudents} context="Enrolled total" icon={<IconUsersKpi />} iconTileClassName={kpiIconCircleViolet} />
            <StatCard layout="kpi" tone="glass" accentPlacement="none" label="Grade Entries" value={metrics.totalEntries.toLocaleString()} context="Across all subjects" icon={<IconClipboardKpi />} iconTileClassName={kpiIconCircleBlue} />
            <StatCard layout="kpi" tone="glass" accentPlacement="none" label="Subjects" value={metrics.subjects.length} context="Reporting departments" icon={<IconBookOpenKpi />} iconTileClassName={kpiIconCircleGreen} />
          </div>

          {/* GCSE Basics */}
          {isGcse && metrics.gcseBasics && (
            <section className="space-y-4 pt-1">
              <SectionHeader title="English & Maths — Headline Measures" />

              <div className="grid grid-cols-3 gap-4">
                {/* 4+ Dark Card */}
                <Link href={`/assessments/${cycleId}/points/${pointId}/em/4`} className="relative overflow-hidden rounded-2xl bg-[var(--primary-container)] p-5 cursor-pointer shadow-ambient calm-transition hover:shadow-lg hover:-translate-y-0.5 block">
                  <div className="flex justify-between items-start">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted">E&M 4+</p>
                    <div className="h-7 w-7 text-muted/60 absolute top-4 right-4">
                      <svg viewBox="0 0 24 24" fill="currentColor">
                         <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                      </svg>
                    </div>
                  </div>
                  <div className="mt-3">
                    <span className="text-[32px] font-bold leading-none tracking-[-0.02em] text-white">{metrics.gcseBasics.em4}%</span>
                  </div>
                  <div className="mt-5 flex h-1.5 w-full overflow-hidden rounded-full bg-primary-container">
                    <div className={`${emProgressFillClass} rounded-r-full`} style={{ width: `${metrics.gcseBasics.em4}%` }}></div>
                  </div>
                </Link>

                {/* 5+ White Card */}
                <Link href={`/assessments/${cycleId}/points/${pointId}/em/5`} className="relative block cursor-pointer overflow-hidden rounded-2xl bg-[var(--surface-container-lowest)] p-5 shadow-ambient calm-transition motion-safe:hover:-translate-y-px motion-safe:hover:shadow-lg">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted">E&M 5+</p>
                  <div className="mt-3">
                    <span className="text-[32px] font-bold leading-none tracking-[-0.02em] text-text">{metrics.gcseBasics.em5}%</span>
                  </div>
                  <div className="mt-5 flex h-1.5 w-full overflow-hidden rounded-full bg-surface-container-low">
                    <div className="bg-[var(--primary-container)] h-full rounded-r-full" style={{ width: `${metrics.gcseBasics.em5}%` }}></div>
                  </div>
                </Link>

                {/* 7+ White Card */}
                <Link href={`/assessments/${cycleId}/points/${pointId}/em/7`} className="relative block cursor-pointer overflow-hidden rounded-2xl bg-[var(--surface-container-lowest)] p-5 shadow-ambient calm-transition motion-safe:hover:-translate-y-px motion-safe:hover:shadow-lg">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted">E&M 7+</p>
                  <div className="mt-3">
                    <span className="text-[32px] font-bold leading-none tracking-[-0.02em] text-text">{metrics.gcseBasics.em7}%</span>
                  </div>
                  <div className="mt-5 flex h-1.5 w-full overflow-hidden rounded-full bg-surface-container-low">
                    <div className="bg-surface-container-high h-full rounded-r-full" style={{ width: `${metrics.gcseBasics.em7}%` }}></div>
                  </div>
                </Link>
              </div>

              {/* PP / SEND gap headline cards (toggle) */}
              <div className="space-y-3 pt-2">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Equity gaps (English & Maths)</p>
                  <div className="segmented-toggle w-fit shrink-0" role="tablist" aria-label="Gap comparison group">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={gcseGapView === "pp"}
                      className={`segmented-toggle-btn ${gcseGapView === "pp" ? "segmented-toggle-btn-active" : ""}`}
                      onClick={() => setGcseGapView("pp")}
                    >
                      PP
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={gcseGapView === "send"}
                      className={`segmented-toggle-btn ${gcseGapView === "send" ? "segmented-toggle-btn-active" : ""}`}
                      onClick={() => setGcseGapView("send")}
                    >
                      SEND
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {gcseGapView === "pp"
                    ? [
                        { label: "PP Gap — 4+ threshold", cohort: metrics.gcseBasics.ppEm4, baseline: metrics.gcseBasics.nonPpEm4, gap: metrics.gcseBasics.gap4, baselineLabel: "NON-PP", cohortLabel: "PP STUDENTS" },
                        { label: "PP Gap — 5+ threshold", cohort: metrics.gcseBasics.ppEm5, baseline: metrics.gcseBasics.nonPpEm5, gap: metrics.gcseBasics.gap5, baselineLabel: "NON-PP", cohortLabel: "PP STUDENTS" },
                      ].map(({ label, cohort, baseline, gap, baselineLabel, cohortLabel }) => (
                        <div key={label} className="rounded-2xl bg-[var(--surface-container-lowest)] p-5 shadow-ambient">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="text-base font-bold tracking-tight text-text">{label}</h3>
                              <p className="mt-0.5 text-xs font-medium text-muted">Pupil Premium vs Non-Pupil Premium</p>
                            </div>
                            <GapBadge gap={gap} />
                          </div>
                          <div className="mt-6 space-y-4">
                            <div>
                              <div className="mb-2 flex items-baseline justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--primary-container)]">{baselineLabel}</span>
                                <span className="text-xl font-bold leading-none tracking-tight text-text">{baseline}%</span>
                              </div>
                              <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface-container-low">
                                <div className="h-full rounded-r-full bg-[var(--primary-container)]" style={{ width: `${baseline}%` }} />
                              </div>
                            </div>
                            <div>
                              <div className="mb-2 flex items-baseline justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-muted">{cohortLabel}</span>
                                <span className="text-xl font-bold leading-none tracking-tight text-muted">{cohort}%</span>
                              </div>
                              <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface-container-low">
                                <div className="h-full rounded-r-full bg-surface-container-high" style={{ width: `${cohort}%` }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    : [
                        { label: "SEND Gap — 4+ threshold", cohort: metrics.gcseBasics.sendEm4, baseline: metrics.gcseBasics.nonSendEm4, gap: metrics.gcseBasics.sendGap4, baselineLabel: "NON-SEND", cohortLabel: "SEND STUDENTS" },
                        { label: "SEND Gap — 5+ threshold", cohort: metrics.gcseBasics.sendEm5, baseline: metrics.gcseBasics.nonSendEm5, gap: metrics.gcseBasics.sendGap5, baselineLabel: "NON-SEND", cohortLabel: "SEND STUDENTS" },
                      ].map(({ label, cohort, baseline, gap, baselineLabel, cohortLabel }) => (
                        <div key={label} className="rounded-2xl bg-[var(--surface-container-lowest)] p-5 shadow-ambient">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="text-base font-bold tracking-tight text-text">{label}</h3>
                              <p className="mt-0.5 text-xs font-medium text-muted">SEND vs Non-SEND</p>
                            </div>
                            <GapBadge gap={gap} />
                          </div>
                          <div className="mt-6 space-y-4">
                            <div>
                              <div className="mb-2 flex items-baseline justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--info)]">{baselineLabel}</span>
                                <span className="text-xl font-bold leading-none tracking-tight text-text">{baseline}%</span>
                              </div>
                              <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface-container-low">
                                <div className="h-full rounded-r-full bg-[var(--info)]" style={{ width: `${baseline}%` }} />
                              </div>
                            </div>
                            <div>
                              <div className="mb-2 flex items-baseline justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-muted">{cohortLabel}</span>
                                <span className="text-xl font-bold leading-none tracking-tight text-muted">{cohort}%</span>
                              </div>
                              <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface-container-low">
                                <div className="h-full rounded-r-full bg-surface-container-high" style={{ width: `${cohort}%` }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                </div>
              </div>
            </section>
          )}

          {/* A-Level overall */}
          {isALevel && metrics.aLevelSummary && (
            <Card className="space-y-4">
              <SectionHeader title="Overall Grade Profile" subtitle={`${metrics.aLevelSummary.total} entries`} />
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "A* rate", val: metrics.aLevelSummary.aStarPct, cls: aLevelBarClasses.aStar },
                  { label: "A or above", val: metrics.aLevelSummary.aPct, cls: aLevelBarClasses.a },
                  { label: "B or above", val: metrics.aLevelSummary.bPct, cls: aLevelBarClasses.b },
                  { label: "C+ pass", val: metrics.aLevelSummary.cPlusPct, cls: aLevelBarClasses.cPlus },
                ].map(({ label, val, cls }) => (
                  <div key={label} className="rounded-xl bg-[var(--surface-container-low)] p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--on-surface-muted)]">{label}</p>
                    <p className="mt-0.5 text-2xl font-bold tabular-nums text-[var(--on-surface)]">{val}%</p>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[var(--surface-container)]">
                      <div className={`h-full rounded-full ${cls}`} style={{ width: `${val}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Subject breakdown table */}
          <div className="space-y-3">
            <SectionHeader title="Subject Breakdown" subtitle={`${metrics.subjects.length} subjects`} />
            <div className="table-shell">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="table-head-row text-left">
                      <th className="px-5 py-3">Subject</th>
                      <th className="px-4 py-3 text-right">N</th>
                      {isGcse && (
                        <>
                          <th className={`px-4 py-3 text-right ${thresholdHeaderGcse.t4}`}>4+</th>
                          <th className={`px-4 py-3 text-right ${thresholdHeaderGcse.t5}`}>5+</th>
                          <th className={`px-4 py-3 text-right ${thresholdHeaderGcse.t7}`}>7+</th>
                        </>
                      )}
                      {isALevel && (
                        <>
                          <th className={`px-4 py-3 text-right ${thresholdHeaderALevel.aStar}`}>A*</th>
                          <th className={`px-4 py-3 text-right ${thresholdHeaderALevel.aPlus}`}>A+</th>
                          <th className={`px-4 py-3 text-right ${thresholdHeaderALevel.bPlus}`}>B+</th>
                          <th className={`px-4 py-3 text-right ${thresholdHeaderALevel.cPlus}`}>C+</th>
                        </>
                      )}
                      <th className="px-4 py-3">Distribution</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.subjects.sort((a, b) => a.subject.localeCompare(b.subject)).map((sm) => (
                      <tr key={sm.subject} className="group table-row calm-transition">
                        <td className="px-5 py-4 font-medium text-[var(--on-surface)]">
                          <Link
                            href={`/assessments/${cycleId}/points/${pointId}/subjects/${encodeURIComponent(sm.subject)}`}
                            className="link-accent calm-transition"
                          >
                            {sm.subject}
                          </Link>
                        </td>
                        <td className="px-4 py-4 text-right tabular-nums text-[var(--on-surface-muted)]">{sm.presentCount}</td>
                        {isGcse && (
                          <>
                            <td className={`px-4 py-4 text-right font-semibold tabular-nums ${thresholdHeaderGcse.t4}`}>{sm.thresholds["4+"]}%</td>
                            <td className={`px-4 py-4 text-right font-semibold tabular-nums ${thresholdHeaderGcse.t5}`}>{sm.thresholds["5+"]}%</td>
                            <td className={`px-4 py-4 text-right font-semibold tabular-nums ${thresholdHeaderGcse.t7}`}>{sm.thresholds["7+"]}%</td>
                          </>
                        )}
                        {isALevel && (
                          <>
                            <td className={`px-4 py-4 text-right font-semibold tabular-nums ${thresholdHeaderALevel.aStar}`}>{sm.thresholds["A*"]}%</td>
                            <td className={`px-4 py-4 text-right font-semibold tabular-nums ${thresholdHeaderALevel.aPlus}`}>{sm.thresholds["A+"]}%</td>
                            <td className={`px-4 py-4 text-right font-semibold tabular-nums ${thresholdHeaderALevel.bPlus}`}>{sm.thresholds["B+"]}%</td>
                            <td className={`px-4 py-4 text-right font-semibold tabular-nums ${thresholdHeaderALevel.cPlus}`}>{sm.thresholds["C+"]}%</td>
                          </>
                        )}
                        <td className="px-4 py-4 min-w-[160px] align-top">
                          {isPercentage ? (
                            pctSummary ? (
                              <PctDistCompact
                                distribution={
                                  pctSummary.subjects.find((s) => s.subject === sm.subject)?.distribution ?? []
                                }
                              />
                            ) : (
                              <span className="text-xs text-[var(--on-surface-muted)]">—</span>
                            )
                          ) : (
                            <DistBar
                              distribution={sm.distribution}
                              format={sm.gradeFormat}
                              onGradeClick={(grade) => {
                                const gNum = Number(grade);
                                setModalView({
                                  type: "GRADE",
                                  subject: sm.subject,
                                  grade,
                                  gradeFormat: sm.gradeFormat,
                                  students: sm.students.filter((s) =>
                                    sm.gradeFormat === "GCSE"
                                      ? s.score !== null && Math.round(s.score * 9) === gNum
                                      : s.rawValue.trim().toUpperCase() === grade.trim().toUpperCase(),
                                  ),
                                });
                              }}
                            />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-border/20 px-5 py-3.5">
                <p className="text-[0.8125rem] text-muted">{metrics.subjects.length} subjects</p>
              </div>
            </div>
          </div>

          {/* PP / SEND gap by subject (GCSE) — toggled */}
          {isGcse && (metrics.subjects.some((sm) => sm.pp) || metrics.subjects.some((sm) => sm.send)) && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <SectionHeader title="Equity Gap by Subject" subtitle="Percentage-point gap between cohorts" />
                <div className="flex overflow-hidden rounded-lg border border-[var(--outline-variant)]/60 text-xs font-semibold">
                  <button type="button" onClick={() => setGapView("pp")} className={`px-4 py-1.5 calm-transition ${gapView === "pp" ? "bg-[var(--surface-container-high)] text-[var(--on-surface)]" : "text-[var(--on-surface-muted)] hover:bg-[var(--surface-container-low)]"}`}>Pupil Premium</button>
                  <button type="button" onClick={() => setGapView("send")} className={`border-l border-[var(--outline-variant)]/60 px-4 py-1.5 calm-transition ${gapView === "send" ? "bg-[var(--surface-container-high)] text-[var(--on-surface)]" : "text-[var(--on-surface-muted)] hover:bg-[var(--surface-container-low)]"}`}>SEND</button>
                </div>
              </div>
              {gapView === "pp" && metrics.subjects.some((sm) => sm.pp) && (
                <div className="table-shell">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="table-head-row text-left">
                          <th className="px-5 py-3">Subject</th>
                          <th className="px-4 py-3 text-right">Non-PP 4+</th>
                          <th className="px-4 py-3 text-right">PP 4+</th>
                          <th className="px-4 py-3 text-right">Gap</th>
                          <th className="px-4 py-3 text-right">Non-PP 5+</th>
                          <th className="px-4 py-3 text-right">PP 5+</th>
                          <th className="px-4 py-3 text-right">Gap</th>
                        </tr>
                      </thead>
                      <tbody>
                        {metrics.subjects
                          .filter((sm) => sm.pp)
                          .sort((a, b) => (b.pp?.gap4 ?? 0) - (a.pp?.gap4 ?? 0))
                          .map((sm) => (
                            <tr key={sm.subject} className="group table-row calm-transition">
                              <td className="px-5 py-4 font-medium text-[var(--on-surface)]">
                                <div className="flex items-center gap-2.5">
                                  <SubjectIcon subject={sm.subject} />
                                  <Link href={`/assessments/${cycleId}/points/${pointId}/subjects/${encodeURIComponent(sm.subject)}`} className="link-accent calm-transition">{sm.subject}</Link>
                                </div>
                              </td>
                              <td className="px-4 py-4 text-right tabular-nums text-[var(--on-surface)]">{sm.pp!.nonPpT4}%</td>
                              <td className={`px-4 py-4 text-right tabular-nums ${ppNumericClass}`}>{sm.pp!.t4}%</td>
                              <td className="px-4 py-4 text-right"><GapBadge gap={sm.pp!.gap4} /></td>
                              <td className="px-4 py-4 text-right tabular-nums text-[var(--on-surface)]">{sm.pp!.nonPpT5}%</td>
                              <td className={`px-4 py-4 text-right tabular-nums ${ppNumericClass}`}>{sm.pp!.t5}%</td>
                              <td className="px-4 py-4 text-right"><GapBadge gap={sm.pp!.gap5} /></td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="border-t border-border/20 px-5 py-3.5">
                    <p className="text-[0.8125rem] text-muted">{metrics.subjects.filter(sm => sm.pp).length} subjects with PP data</p>
                  </div>
                </div>
              )}
              {gapView === "pp" && !metrics.subjects.some((sm) => sm.pp) && (
                <p className="text-sm text-[var(--on-surface-muted)] py-4">No Pupil Premium data for this result point.</p>
              )}
              {gapView === "send" && metrics.subjects.some((sm) => sm.send) && (
                <div className="table-shell">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="table-head-row text-left">
                          <th className="px-5 py-3">Subject</th>
                          <th className="px-4 py-3 text-right">Non-SEND 4+</th>
                          <th className="px-4 py-3 text-right">SEND 4+</th>
                          <th className="px-4 py-3 text-right">Gap</th>
                          <th className="px-4 py-3 text-right">Non-SEND 5+</th>
                          <th className="px-4 py-3 text-right">SEND 5+</th>
                          <th className="px-4 py-3 text-right">Gap</th>
                        </tr>
                      </thead>
                      <tbody>
                        {metrics.subjects
                          .filter((sm) => sm.send)
                          .sort((a, b) => (b.send?.gap4 ?? 0) - (a.send?.gap4 ?? 0))
                          .map((sm) => (
                            <tr key={sm.subject} className="group table-row calm-transition">
                              <td className="px-5 py-4 font-medium text-[var(--on-surface)]">
                                <div className="flex items-center gap-2.5">
                                  <SubjectIcon subject={sm.subject} />
                                  <Link href={`/assessments/${cycleId}/points/${pointId}/subjects/${encodeURIComponent(sm.subject)}`} className="link-accent calm-transition">{sm.subject}</Link>
                                </div>
                              </td>
                              <td className="px-4 py-4 text-right tabular-nums text-[var(--on-surface)]">{sm.send!.nonSendT4}%</td>
                              <td className={`px-4 py-4 text-right tabular-nums ${sendNumericClass}`}>{sm.send!.t4}%</td>
                              <td className="px-4 py-4 text-right"><GapBadge gap={sm.send!.gap4} /></td>
                              <td className="px-4 py-4 text-right tabular-nums text-[var(--on-surface)]">{sm.send!.nonSendT5}%</td>
                              <td className={`px-4 py-4 text-right tabular-nums ${sendNumericClass}`}>{sm.send!.t5}%</td>
                              <td className="px-4 py-4 text-right"><GapBadge gap={sm.send!.gap5} /></td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="border-t border-border/20 px-5 py-3.5">
                    <p className="text-[0.8125rem] text-muted">{metrics.subjects.filter(sm => sm.send).length} subjects with SEND data</p>
                  </div>
                </div>
              )}
              {gapView === "send" && !metrics.subjects.some((sm) => sm.send) && (
                <p className="text-sm text-[var(--on-surface-muted)] py-4">No SEND data for this result point.</p>
              )}
            </div>
          )}

          {/* ── Percentage / Raw score analysis ────────────────────────────── */}
          {isPercentage && pctSummary && pctYearHistogram && (
            <>
              {/* Year overview */}
              <section className="space-y-4 pt-1">
                <SectionHeader
                  title="Year Group Overview"
                  subtitle={`Mean score: ${pctSummary.yearMean}% across ${pctSummary.subjects.length} subjects`}
                />
                <Card className="space-y-3">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--on-surface-muted)]">
                      Score distribution (histogram)
                    </p>
                    <p className="text-[0.8125rem] leading-snug text-muted">
                      Each bar is how many{" "}
                      <span className="font-medium text-[var(--on-surface)]">student–subject results</span> fall in that 10% score band (one count per
                      subject sat, not unique students). Colours group bands into below 40%, 40–70%, and 70%+.
                    </p>
                  </div>
                  <div
                    className="flex h-44 gap-1"
                    role="img"
                    aria-label={`Histogram of ${pctYearHistogram.total} results across ten percent score bands`}
                  >
                    {pctSummary.distribution.map((b) => {
                      const heightPct = pctYearHistogram.maxBand > 0 ? (b.count / pctYearHistogram.maxBand) * 100 : 0;
                      const inTop = b.from >= 70;
                      const inBottom = b.to <= 40;
                      const bg = inTop ? barPositiveClass : inBottom ? barNegativeClass : barNeutralClass;
                      return (
                        <div
                          key={b.band}
                          className="relative flex min-h-0 min-w-0 flex-1 flex-col justify-end"
                          title={`${b.band}: ${b.count} results (${b.pct}% of charted results)`}
                        >
                          {b.count > 0 ? (
                            <span
                              className="pointer-events-none absolute left-1/2 z-[1] -translate-x-1/2 text-[9px] font-semibold tabular-nums leading-none text-[var(--on-surface)]"
                              style={{ bottom: `calc(${heightPct}% + 2px)` }}
                              aria-hidden
                            >
                              {b.pct}%
                            </span>
                          ) : null}
                          <div
                            className={`w-full rounded-t ${bg} opacity-90 transition-[height] duration-150`}
                            style={{
                              height: `${heightPct}%`,
                              minHeight: b.count > 0 ? 4 : 0,
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between gap-0.5 text-[9px] tabular-nums text-[var(--on-surface-muted)]">
                    {pctSummary.distribution.map((b) => (
                      <span key={b.band} className="min-w-0 flex-1 truncate text-center" title={b.band}>
                        {b.from}%
                      </span>
                    ))}
                    <span className="min-w-0 flex-1 truncate text-center" title="100%">
                      100%
                    </span>
                  </div>
                  <p className="text-[10px] text-[var(--on-surface-muted)]">
                    Total results in chart:{" "}
                    <span className="font-semibold tabular-nums text-[var(--on-surface)]">{pctYearHistogram.total}</span>
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[10px] text-[var(--on-surface-muted)]">
                    <span className="flex items-center gap-1.5">
                      <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-sm ${swatchLowClass}`} />
                      <span>
                        Below 40%:{" "}
                        <span className="font-semibold tabular-nums text-[var(--on-surface)]">{pctYearHistogram.below40}</span>
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-sm ${swatchMidClass}`} />
                      <span>
                        40–70%:{" "}
                        <span className="font-semibold tabular-nums text-[var(--on-surface)]">{pctYearHistogram.band4070}</span>
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-sm ${swatchHighClass}`} />
                      <span>
                        70%+:{" "}
                        <span className="font-semibold tabular-nums text-[var(--on-surface)]">{pctYearHistogram.band70p}</span>
                      </span>
                    </span>
                  </div>
                </Card>
              </section>

              {/* Subject performance table */}
              <div className="space-y-3">
                <SectionHeader title="Subject Performance" subtitle="Click a subject to see teaching group breakdown" />
                <div className="table-shell">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="table-head-row text-left">
                          <th className="px-5 py-3">Subject</th>
                          <th className="px-4 py-3 text-right">N</th>
                          <th className="px-4 py-3 text-right">Mean</th>
                          <th className="px-4 py-3 text-right">Median</th>
                          <th className={`px-4 py-3 text-right ${ppNumericClass}`}>PP mean</th>
                          <th className="px-4 py-3 text-right">PP gap</th>
                          <th className={`px-4 py-3 text-right ${sendNumericClass}`}>SEND mean</th>
                          <th className="px-4 py-3 text-right">SEND gap</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pctSummary.subjects.map((sm) => {
                          const isExpanded = expandedPctSubject === sm.subject;
                          const gapCls = (gap: number | null) =>
                            gap === null ? "" : gap <= 5 ? "text-[var(--success)]" : gap <= 15 ? "text-[var(--warning-text)]" : "text-[var(--error)]";
                          return (
                            <>
                              <tr
                                key={sm.subject}
                                className="group table-row calm-transition cursor-pointer"
                                onClick={() => setExpandedPctSubject(isExpanded ? null : sm.subject)}
                              >
                                <td className="px-5 py-4 font-medium text-[var(--accent)]">
                                  {sm.subject}
                                  <span className="ml-1 text-[10px] text-[var(--on-surface-muted)]">{isExpanded ? "▲" : "▼"}</span>
                                </td>
                                <td className="px-4 py-4 text-right tabular-nums text-[var(--on-surface-muted)]">{sm.presentCount}</td>
                                <td className="px-4 py-4 text-right font-bold tabular-nums text-[var(--on-surface)]">{sm.mean}%</td>
                                <td className="px-4 py-4 text-right tabular-nums text-[var(--on-surface-muted)]">{sm.median}%</td>
                                <td className={`px-4 py-4 text-right tabular-nums ${ppNumericClass}`}>
                                  {sm.ppMean !== null ? `${sm.ppMean}%` : "—"}
                                </td>
                                <td className={`px-4 py-4 text-right font-semibold tabular-nums ${gapCls(sm.ppGap)}`}>
                                  {sm.ppGap !== null ? `${sm.ppGap > 0 ? "+" : ""}${sm.ppGap}pp` : "—"}
                                </td>
                                <td className={`px-4 py-4 text-right tabular-nums ${sendNumericClass}`}>
                                  {sm.sendMean !== null ? `${sm.sendMean}%` : "—"}
                                </td>
                                <td className={`px-4 py-4 text-right font-semibold tabular-nums ${gapCls(sm.sendGap)}`}>
                                  {sm.sendGap !== null ? `${sm.sendGap > 0 ? "+" : ""}${sm.sendGap}pp` : "—"}
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr key={`${sm.subject}-detail`}>
                                  <td colSpan={8} className="bg-[var(--surface-container-low)] px-5 py-4">
                                    <div className="grid grid-cols-2 gap-6">
                                      {/* Teaching group breakdown */}
                                      {sm.teachingGroups.length > 0 && (
                                        <div>
                                          <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[var(--on-surface-muted)]">Class vs year mean ({sm.mean}%)</p>
                                          <div className="space-y-1.5">
                                            {sm.teachingGroups.map((tg) => (
                                              <div key={tg.group} className="flex items-center gap-2">
                                                <span className="w-32 truncate text-xs text-[var(--on-surface)]">{tg.group}</span>
                                                <div className="flex h-4 flex-1 overflow-hidden rounded bg-[var(--surface-container)]">
                                                  <div
                                                    className={`h-full rounded ${tg.vsYearMean >= 0 ? barPositiveClass : barNegativeClass}`}
                                                    style={{ width: `${Math.min(100, (tg.mean / 100) * 100)}%` }}
                                                  />
                                                </div>
                                                <span className="w-12 text-right text-xs font-bold tabular-nums text-[var(--on-surface)]">{tg.mean}%</span>
                                                <span className={`w-14 text-right text-[10px] font-semibold tabular-nums ${tg.vsYearMean >= 0 ? "text-[var(--success)]" : "text-[var(--error)]"}`}>
                                                  {tg.vsYearMean > 0 ? "+" : ""}{tg.vsYearMean}pp
                                                </span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                      {/* Top & bottom students */}
                                      <div className="grid grid-cols-2 gap-4">
                                        {[{ title: "Top 10", students: sm.topStudents, cls: "text-[var(--success)]" }, { title: "Bottom 10", students: sm.bottomStudents, cls: "text-[var(--error)]" }].map(({ title, students, cls }) => (
                                          <div key={title}>
                                            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--on-surface-muted)]">{title}</p>
                                            <div className="space-y-0.5">
                                              {students.map((s) => (
                                                <div key={s.studentId} className="flex items-center justify-between gap-2">
                                                  <span className="truncate text-xs text-[var(--on-surface)]">
                                                    {s.name}
                                                    {s.ppFlag && <span className={`ml-1 ${ppInlineBadgeClass}`}>PP</span>}
                                                    {s.sendFlag && <span className={`ml-1 ${sendInlineBadgeClass}`}>SEN</span>}
                                                  </span>
                                                  <span className={`shrink-0 text-xs font-bold tabular-nums ${cls}`}>{s.score}%</span>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="border-t border-border/20 px-5 py-3.5">
                    <p className="text-[0.8125rem] text-muted">{pctSummary.subjects.length} subjects · year mean {pctSummary.yearMean}%</p>
                  </div>
                </div>
              </div>

              {/* Overall leaderboard */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { title: "Top 10 students", subtitle: "Highest overall mean", students: pctSummary.overallTop, cls: "text-[var(--success)]" },
                  { title: "Bottom 10 students", subtitle: "Lowest overall mean — may need support", students: pctSummary.overallBottom, cls: "text-[var(--error)]" },
                ].map(({ title, subtitle, students, cls }) => (
                  <Card key={title} className="space-y-3">
                    <SectionHeader title={title} subtitle={subtitle} />
                    <div className="space-y-1.5">
                      {students.map((s, i) => (
                        <div key={s.studentId} className="flex items-center gap-2">
                          <span className="w-5 text-right text-[10px] font-bold tabular-nums text-[var(--on-surface-muted)]">{s.rank}</span>
                          <span className="flex-1 truncate text-sm text-[var(--on-surface)]">
                            {s.name}
                            {s.ppFlag && <span className={`ml-1 ${ppInlineBadgeClassLg}`}>PP</span>}
                            {s.sendFlag && <span className={`ml-1 ${sendInlineBadgeClassLg}`}>SEN</span>}
                          </span>
                          <span className={`shrink-0 text-sm font-bold tabular-nums ${cls}`}>{s.overallMean}%</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}

        </>
      )}

      {/* Modal overlay — grade-level and E&M drill-downs */}
      {modalView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-[var(--surface)] text-[var(--on-surface)] rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col border border-[var(--outline-variant)]/50">
            <div className="flex items-center justify-between p-4 border-b border-[var(--outline-variant)]/20">
              <h2 className="text-lg font-bold">
                {modalView.type === 'GRADE'
                  ? `Students scoring ${modalView.grade} in ${modalView.subject}`
                  : `E&M Baseline: ${modalView.label} Students`}
              </h2>
              <button
                onClick={() => setModalView(null)}
                className="text-[var(--on-surface-muted)] hover:text-[var(--on-surface)] p-2 rounded-lg hover:bg-[var(--surface-container)] transition-colors"
                aria-label="Close modal">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="p-3 overflow-y-auto flex-1">
              {modalView.type === 'EM' && (
                <div className="table-shell border-0 shadow-none">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 z-10 border-b border-[var(--outline-variant)]/20 anx-card-inset">
                      <tr className="table-head-row">
                        <th className="px-5 py-3">Student</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-4 py-3 text-center">English Grade</th>
                        <th className="px-4 py-3 text-center">Maths Grade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modalView.students
                        .sort((a, b) => {
                          if (a.met !== b.met) return a.met ? -1 : 1;
                          return a.name.localeCompare(b.name);
                        })
                        .map((st) => (
                          <tr key={st.studentId} className="table-row calm-transition">
                            <td className="px-5 py-3 font-medium">
                              <Link
                                href={`/students/${st.studentId}`}
                                className="calm-transition hover:text-[var(--accent)]"
                              >
                                {st.name}
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {st.met ? <span className={metPillClass}>Met</span> : <span className={notMetPillClass}>Not Met</span>}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className={`inline-flex h-8 min-w-[2rem] items-center justify-center rounded-lg px-2 text-sm font-bold ${gcseGradeBadgeClass(st.engRaw)}`}
                              >
                                {st.engRaw}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className={`inline-flex h-8 min-w-[2rem] items-center justify-center rounded-lg px-2 text-sm font-bold ${gcseGradeBadgeClass(st.mathRaw)}`}
                              >
                                {st.mathRaw}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}

              {modalView.type === 'GRADE' && (
                <div className="table-shell border-0 shadow-none">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 z-10 border-b border-[var(--outline-variant)]/20 anx-card-inset">
                      <tr className="table-head-row">
                        <th className="px-5 py-3">Student</th>
                        <th className="px-4 py-3 text-center">Grade in {modalView.subject}</th>
                        <th className="px-4 py-3 text-center">Avg Grade (All Subjects)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modalView.students.sort((a, b) => a.name.localeCompare(b.name)).map(st => {
                        const allScores = metrics?.subjects.flatMap(sm => sm.students.filter(s => s.studentId === st.studentId && s.score !== null).map(s => s.score!)) || [];
                        const avg = allScores.length > 0 ? (allScores.reduce((a,b) => a+b, 0) / allScores.length) : null;
                        const avgDisplay = avg !== null ? (metrics?.dominantFormat === 'GCSE' ? (avg * 9).toFixed(1) : (avg * 100).toFixed(0) + '%') : 'N/A';
                        return (
                          <tr key={st.studentId} className="table-row calm-transition">
                            <td className="px-5 py-3 font-medium">
                              <Link href={`/students/${st.studentId}`} className="calm-transition hover:text-[var(--accent)]">
                                {st.name}
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className={`inline-flex h-8 min-w-[2rem] items-center justify-center rounded-lg px-2 text-sm font-bold ${
                                  modalView.gradeFormat === "GCSE"
                                    ? gcseNumericCellClass(st.rawValue)
                                    : aLevelLetterCellClass(st.rawValue)
                                }`}
                              >
                                {st.rawValue}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center text-[var(--on-surface-muted)]">{avgDisplay}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {modalView.students.length === 0 && (
                 <div className="p-8 text-center text-[var(--on-surface-muted)]">
                   No student data available.
                 </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
