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
import type { GradeFormat, PointType, ResultStatus } from "@prisma/client";

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
  sendEm4: number; nonSendEm4: number; sendGap4: number;
  students4: EMStudentResult[];
  students5: EMStudentResult[];
  students7: EMStudentResult[];
};

type ModalView =
  | { type: 'EM', label: string, students: EMStudentResult[], target: number }
  | { type: 'GRADE', subject: string, grade: string, students: StudentResult[] }
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

// ─── Colour helpers ───────────────────────────────────────────────────────────

function gapCls(gap: number) {
  if (gap <= 5) return "text-[var(--success)]";
  if (gap <= 15) return "text-[var(--warning)]";
  return "text-[var(--error)]";
}

function GapBadge({ gap }: { gap: number }) {
  const cls = gap <= 5
    ? "bg-emerald-50 text-emerald-700"
    : gap <= 15
      ? "bg-amber-50 text-amber-700"
      : "bg-red-50 text-red-700";
  return (
    <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[11px] font-bold tabular-nums ${cls}`}>
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
  if (from >= 70) return { bar: "bg-emerald-500 text-white", swatch: "bg-emerald-500" };
  if (to <= 40) return { bar: "bg-red-400 text-white", swatch: "bg-red-400" };
  return { bar: "bg-indigo-100 text-indigo-950", swatch: "bg-indigo-100" };
}

function gradeDistributionBarStyle(
  grade: string,
  format: "GCSE" | "A_LEVEL",
): { bar: string; swatch: string } {
  if (format === "GCSE") {
    const n = Number(grade);
    if (Number.isFinite(n) && n >= 8) return { bar: "bg-emerald-500 text-white", swatch: "bg-emerald-500" };
    if (Number.isFinite(n) && n <= 2) return { bar: "bg-red-400 text-white", swatch: "bg-red-400" };
    return { bar: "bg-indigo-100 text-indigo-950", swatch: "bg-indigo-100" };
  }
  const g = grade.toUpperCase();
  if (g === "A*" || g === "A") return { bar: "bg-emerald-500 text-white", swatch: "bg-emerald-500" };
  if (g === "U" || g === "E") return { bar: "bg-red-400 text-white", swatch: "bg-red-400" };
  return { bar: "bg-indigo-100 text-indigo-950", swatch: "bg-indigo-100" };
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

const POINT_TYPE_COLOURS: Record<string, string> = {
  BASELINE: "bg-[var(--surface-container)] text-[var(--on-surface-muted)]",
  INTERNAL_ASSESSMENT: "bg-blue-100 text-blue-700",
  INTERNAL_MOCK: "bg-amber-100 text-amber-700",
  TEACHER_PREDICTION: "bg-violet-100 text-violet-700",
  EXTERNAL_FINAL: "bg-emerald-100 text-emerald-700",
  OTHER: "bg-[var(--surface-container)] text-[var(--on-surface-muted)]",
};

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
      <span className="rounded-full bg-[var(--surface-container)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--on-surface-muted)]">
        {STATUS_LABELS[point.resultStatus]}
      </span>
      {point.isFinalPoint && (
        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
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
    <div className="w-full space-y-7">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[var(--on-surface-muted)]">
        <Link href="/assessments" className="calm-transition hover:text-[var(--on-surface)]">Cycles</Link>
        <span>›</span>
        <Link href={`/assessments/${cycleId}`} className="calm-transition hover:text-[var(--on-surface)]">{point?.cycle.label ?? "Cycle"}</Link>
        <span>›</span>
        <span className="text-[var(--on-surface)]">{point?.label ?? "Result point"}</span>
      </div>

      {/* Page Header */}
      <PageHeader
        eyebrow={point?.cycle.label}
        title={point?.label ?? "Result Point"}
        meta={metaBadges}
        actions={headerActions}
      />

      {error && <p className="text-sm text-[var(--error)]">{error}</p>}

      {metrics && metrics.totalEntries === 0 && (
        <Card className="py-12 text-center">
          <p className="text-[var(--on-surface-muted)]">No results uploaded for this result point.</p>
          <Link
            href={`/assessments/${cycleId}/points/${pointId}/upload`}
            className="mt-2 inline-block text-sm text-[var(--accent)] hover:underline"
          >
            Upload subject results
          </Link>
        </Card>
      )}

      {metrics && metrics.totalEntries > 0 && (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-5">
            <StatCard label="Students Assessed" value={metrics.totalStudents} context="Enrolled total" />
            <StatCard label="Grade Entries" value={metrics.totalEntries.toLocaleString()} context="98% completion" accent="success" />
            <StatCard label="Subjects" value={metrics.subjects.length} context="Reporting depts" />
          </div>

          {/* GCSE Basics */}
          {isGcse && metrics.gcseBasics && (
            <section className="space-y-4 pt-1">
              <SectionHeader title="English & Maths — Headline Measures" />

              <div className="grid grid-cols-3 gap-4">
                {/* 4+ Dark Card */}
                <Link href={`/assessments/${cycleId}/points/${pointId}/em/4`} className="relative overflow-hidden rounded-2xl bg-[#0f172a] p-5 cursor-pointer shadow-ambient calm-transition hover:shadow-lg hover:-translate-y-0.5 block">
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
                    <div className="bg-emerald-500 rounded-r-full" style={{ width: `${metrics.gcseBasics.em4}%` }}></div>
                  </div>
                </Link>

                {/* 5+ White Card */}
                <Link href={`/assessments/${cycleId}/points/${pointId}/em/5`} className="relative overflow-hidden rounded-2xl bg-white p-5 cursor-pointer shadow-ambient calm-transition hover:shadow-lg hover:-translate-y-0.5 block">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted">E&M 5+</p>
                  <div className="mt-3">
                    <span className="text-[32px] font-bold leading-none tracking-[-0.02em] text-text">{metrics.gcseBasics.em5}%</span>
                  </div>
                  <div className="mt-5 flex h-1.5 w-full overflow-hidden rounded-full bg-surface-container-low">
                    <div className="bg-[#0f172a] h-full rounded-r-full" style={{ width: `${metrics.gcseBasics.em5}%` }}></div>
                  </div>
                </Link>

                {/* 7+ White Card */}
                <Link href={`/assessments/${cycleId}/points/${pointId}/em/7`} className="relative overflow-hidden rounded-2xl bg-white p-5 cursor-pointer shadow-ambient calm-transition hover:shadow-lg hover:-translate-y-0.5 block">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted">E&M 7+</p>
                  <div className="mt-3">
                    <span className="text-[32px] font-bold leading-none tracking-[-0.02em] text-text">{metrics.gcseBasics.em7}%</span>
                  </div>
                  <div className="mt-5 flex h-1.5 w-full overflow-hidden rounded-full bg-surface-container-low">
                    <div className="bg-surface-container-high h-full rounded-r-full" style={{ width: `${metrics.gcseBasics.em7}%` }}></div>
                  </div>
                </Link>
              </div>

              {/* PP gap full cards */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                {[
                  { label: "PP Gap — 4+ threshold", pp: metrics.gcseBasics.ppEm4, nonPp: metrics.gcseBasics.nonPpEm4, gap: metrics.gcseBasics.gap4 },
                  { label: "PP Gap — 5+ threshold", pp: metrics.gcseBasics.ppEm5, nonPp: metrics.gcseBasics.nonPpEm5, gap: metrics.gcseBasics.gap5 },
                ].map(({ label, pp, nonPp, gap }) => (
                  <div key={label} className="rounded-2xl bg-white p-5 shadow-ambient">
                    <div className="flex items-start justify-between">
                       <div>
                         <h3 className="text-base font-bold tracking-tight text-text">{label}</h3>
                         <p className="text-xs font-medium text-muted mt-0.5">Pupil Premium vs Non-Pupil Premium</p>
                       </div>
                       <GapBadge gap={gap} />
                    </div>

                    <div className="mt-6 space-y-4">
                      <div>
                        <div className="flex justify-between items-baseline mb-2">
                           <span className="text-[10px] font-bold uppercase tracking-widest text-[#0f172a]">NON-PP</span>
                           <span className="text-xl font-bold leading-none tracking-tight text-text">{nonPp}%</span>
                        </div>
                        <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface-container-low">
                          <div className="bg-[#0f172a] h-full rounded-r-full" style={{ width: `${nonPp}%` }}></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between items-baseline mb-2">
                           <span className="text-[10px] font-bold uppercase tracking-widest text-muted">PP STUDENTS</span>
                           <span className="text-xl font-bold leading-none tracking-tight text-muted">{pp}%</span>
                        </div>
                        <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface-container-low">
                          <div className="bg-surface-container-high h-full rounded-r-full" style={{ width: `${pp}%` }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* A-Level overall */}
          {isALevel && metrics.aLevelSummary && (
            <Card className="space-y-4">
              <SectionHeader title="Overall Grade Profile" subtitle={`${metrics.aLevelSummary.total} entries`} />
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "A* rate", val: metrics.aLevelSummary.aStarPct, cls: "bg-emerald-600" },
                  { label: "A or above", val: metrics.aLevelSummary.aPct, cls: "bg-green-500" },
                  { label: "B or above", val: metrics.aLevelSummary.bPct, cls: "bg-blue-500" },
                  { label: "C+ pass", val: metrics.aLevelSummary.cPlusPct, cls: "bg-violet-500" },
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
                          <th className="px-4 py-3 text-right text-amber-600">4+</th>
                          <th className="px-4 py-3 text-right text-violet-600">5+</th>
                          <th className="px-4 py-3 text-right text-green-600">7+</th>
                        </>
                      )}
                      {isALevel && (
                        <>
                          <th className="px-4 py-3 text-right text-emerald-600">A*</th>
                          <th className="px-4 py-3 text-right text-green-600">A+</th>
                          <th className="px-4 py-3 text-right text-blue-600">B+</th>
                          <th className="px-4 py-3 text-right text-violet-600">C+</th>
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
                            className="text-[var(--accent)] calm-transition hover:underline"
                          >
                            {sm.subject}
                          </Link>
                        </td>
                        <td className="px-4 py-4 text-right tabular-nums text-[var(--on-surface-muted)]">{sm.presentCount}</td>
                        {isGcse && (
                          <>
                            <td className="px-4 py-4 text-right font-semibold tabular-nums text-amber-600">{sm.thresholds["4+"]}%</td>
                            <td className="px-4 py-4 text-right font-semibold tabular-nums text-violet-600">{sm.thresholds["5+"]}%</td>
                            <td className="px-4 py-4 text-right font-semibold tabular-nums text-green-600">{sm.thresholds["7+"]}%</td>
                          </>
                        )}
                        {isALevel && (
                          <>
                            <td className="px-4 py-4 text-right font-semibold tabular-nums text-emerald-600">{sm.thresholds["A*"]}%</td>
                            <td className="px-4 py-4 text-right font-semibold tabular-nums text-green-600">{sm.thresholds["A+"]}%</td>
                            <td className="px-4 py-4 text-right font-semibold tabular-nums text-blue-600">{sm.thresholds["B+"]}%</td>
                            <td className="px-4 py-4 text-right font-semibold tabular-nums text-violet-600">{sm.thresholds["C+"]}%</td>
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

          {/* PP gap table (GCSE) */}
          {isGcse && metrics.subjects.some((sm) => sm.pp) && (
            <div className="space-y-3">
              <SectionHeader title="Pupil Premium Gap by Subject" subtitle="Percentage-point gap between Non-PP and PP students" />
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
                              <Link
                                href={`/assessments/${cycleId}/points/${pointId}/subjects/${encodeURIComponent(sm.subject)}`}
                                className="text-[var(--accent)] calm-transition hover:underline"
                              >
                                {sm.subject}
                              </Link>
                            </td>
                            <td className="px-4 py-4 text-right tabular-nums text-[var(--on-surface)]">{sm.pp!.nonPpT4}%</td>
                            <td className="px-4 py-4 text-right tabular-nums text-violet-500">{sm.pp!.t4}%</td>
                            <td className="px-4 py-4 text-right">
                              <GapBadge gap={sm.pp!.gap4} />
                            </td>
                            <td className="px-4 py-4 text-right tabular-nums text-[var(--on-surface)]">{sm.pp!.nonPpT5}%</td>
                            <td className="px-4 py-4 text-right tabular-nums text-violet-500">{sm.pp!.t5}%</td>
                            <td className="px-4 py-4 text-right">
                              <GapBadge gap={sm.pp!.gap5} />
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                <div className="border-t border-border/20 px-5 py-3.5">
                  <p className="text-[0.8125rem] text-muted">
                    {metrics.subjects.filter(sm => sm.pp).length} subjects with PP data
                  </p>
                </div>
              </div>
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
                      const bg = inTop ? "bg-emerald-500" : inBottom ? "bg-red-400" : "bg-indigo-100";
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
                      <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm bg-red-400" />
                      <span>
                        Below 40%:{" "}
                        <span className="font-semibold tabular-nums text-[var(--on-surface)]">{pctYearHistogram.below40}</span>
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm bg-indigo-100" />
                      <span>
                        40–70%:{" "}
                        <span className="font-semibold tabular-nums text-[var(--on-surface)]">{pctYearHistogram.band4070}</span>
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm bg-emerald-500" />
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
                          <th className="px-4 py-3 text-right text-violet-600">PP mean</th>
                          <th className="px-4 py-3 text-right">PP gap</th>
                          <th className="px-4 py-3 text-right text-blue-600">SEND mean</th>
                          <th className="px-4 py-3 text-right">SEND gap</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pctSummary.subjects.map((sm) => {
                          const isExpanded = expandedPctSubject === sm.subject;
                          const gapCls = (gap: number | null) =>
                            gap === null ? "" : gap <= 5 ? "text-[var(--success)]" : gap <= 15 ? "text-amber-500" : "text-[var(--error)]";
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
                                <td className="px-4 py-4 text-right tabular-nums text-violet-500">
                                  {sm.ppMean !== null ? `${sm.ppMean}%` : "—"}
                                </td>
                                <td className={`px-4 py-4 text-right font-semibold tabular-nums ${gapCls(sm.ppGap)}`}>
                                  {sm.ppGap !== null ? `${sm.ppGap > 0 ? "+" : ""}${sm.ppGap}pp` : "—"}
                                </td>
                                <td className="px-4 py-4 text-right tabular-nums text-blue-500">
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
                                                    className={`h-full rounded ${tg.vsYearMean >= 0 ? "bg-emerald-400" : "bg-red-400"}`}
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
                                                    {s.ppFlag && <span className="ml-1 rounded-full bg-violet-100 px-1 text-[9px] text-violet-700">PP</span>}
                                                    {s.sendFlag && <span className="ml-1 rounded-full bg-blue-100 px-1 text-[9px] text-blue-700">SEN</span>}
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
                            {s.ppFlag && <span className="ml-1 rounded-full bg-violet-100 px-1.5 text-[9px] text-violet-700">PP</span>}
                            {s.sendFlag && <span className="ml-1 rounded-full bg-blue-100 px-1.5 text-[9px] text-blue-700">SEN</span>}
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

          {/* SEND gap table (GCSE) */}
          {isGcse && metrics.subjects.some((sm) => sm.send) && (
            <div className="space-y-3">
              <SectionHeader title="SEND Gap by Subject" subtitle="Percentage-point gap between Non-SEND and SEND students" />
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
                              <Link
                                href={`/assessments/${cycleId}/points/${pointId}/subjects/${encodeURIComponent(sm.subject)}`}
                                className="text-[var(--accent)] calm-transition hover:underline"
                              >
                                {sm.subject}
                              </Link>
                            </td>
                            <td className="px-4 py-4 text-right tabular-nums text-[var(--on-surface)]">{sm.send!.nonSendT4}%</td>
                            <td className="px-4 py-4 text-right tabular-nums text-violet-500">{sm.send!.t4}%</td>
                            <td className="px-4 py-4 text-right">
                              <GapBadge gap={sm.send!.gap4} />
                            </td>
                            <td className="px-4 py-4 text-right tabular-nums text-[var(--on-surface)]">{sm.send!.nonSendT5}%</td>
                            <td className="px-4 py-4 text-right tabular-nums text-violet-500">{sm.send!.t5}%</td>
                            <td className="px-4 py-4 text-right">
                              <GapBadge gap={sm.send!.gap5} />
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                <div className="border-t border-border/20 px-5 py-3.5">
                  <p className="text-[0.8125rem] text-muted">
                    {metrics.subjects.filter(sm => sm.send).length} subjects with SEND data
                  </p>
                </div>
              </div>
            </div>
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

            <div className="p-0 overflow-y-auto flex-1">
              {modalView.type === 'EM' && (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-[var(--surface)] border-b border-[var(--outline-variant)]/20 shadow-sm z-10">
                    <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--on-surface-muted)]">
                      <th className="p-3 pl-4">Student</th>
                      <th className="p-3 text-center">Status</th>
                      <th className="p-3 text-center">English Grade</th>
                      <th className="p-3 text-center">Maths Grade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--outline-variant)]/10">
                    {modalView.students.sort((a, b) => {
                       if (a.met !== b.met) return a.met ? -1 : 1;
                       return a.name.localeCompare(b.name);
                    }).map(st => (
                      <tr key={st.studentId} className="hover:bg-[var(--surface-container-low)]/50 transition-colors">
                        <td className="p-3 pl-4 font-medium">
                          <Link href={`/students/${st.studentId}`} className="calm-transition hover:text-[var(--accent)]">
                            {st.name}
                          </Link>
                        </td>
                        <td className="p-3 text-center">
                          {st.met ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">Met</span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">Not Met</span>
                          )}
                        </td>
                        <td className="p-3 text-center font-semibold text-[var(--accent)]">{st.engRaw}</td>
                        <td className="p-3 text-center font-semibold text-[var(--accent)]">{st.mathRaw}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {modalView.type === 'GRADE' && (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-[var(--surface)] border-b border-[var(--outline-variant)]/20 shadow-sm z-10">
                    <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--on-surface-muted)]">
                      <th className="p-3 pl-4">Student</th>
                      <th className="p-3 text-center">Grade in {modalView.subject}</th>
                      <th className="p-3 text-center">Avg Grade (All Subjects)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--outline-variant)]/10">
                    {modalView.students.sort((a, b) => a.name.localeCompare(b.name)).map(st => {
                      const allScores = metrics?.subjects.flatMap(sm => sm.students.filter(s => s.studentId === st.studentId && s.score !== null).map(s => s.score!)) || [];
                      const avg = allScores.length > 0 ? (allScores.reduce((a,b) => a+b, 0) / allScores.length) : null;
                      const avgDisplay = avg !== null ? (metrics?.dominantFormat === 'GCSE' ? (avg * 9).toFixed(1) : (avg * 100).toFixed(0) + '%') : 'N/A';
                      return (
                        <tr key={st.studentId} className="hover:bg-[var(--surface-container-low)]/50 transition-colors">
                          <td className="p-3 pl-4 font-medium">
                            <Link href={`/students/${st.studentId}`} className="calm-transition hover:text-[var(--accent)]">
                              {st.name}
                            </Link>
                          </td>
                          <td className="p-3 text-center font-semibold text-[var(--accent)]">{st.rawValue}</td>
                          <td className="p-3 text-center text-[var(--on-surface-muted)]">{avgDisplay}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
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
