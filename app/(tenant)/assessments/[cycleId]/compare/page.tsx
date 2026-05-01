"use client";

/**
 * Comparison View — Two Result Points
 *
 * Compare any two eligible result points within the same cycle.
 * Shows threshold movement, student delta distribution, subject ranking,
 * and top improvers/decliners.
 */

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import Link from "next/link";
import { DataTableEmpty } from "@/components/ui/data-table-empty";
import { AssessmentsBreadcrumb } from "@/components/assessments/assessments-chrome";
import { AttainmentPageShell } from "@/components/assessments/AttainmentPageShell";
import type { PointType, ResultStatus } from "@prisma/client";
import {
  finalPointChipClass,
  pointTypePillClasses,
  ppInlineBadgeClassLg,
  sendInlineBadgeClassLg,
} from "@/modules/assessments/attainmentColours";

// ─── Types ────────────────────────────────────────────────────────────────────

type Point = { id: string; label: string; pointType: PointType; resultStatus: ResultStatus; isFinalPoint: boolean };
type Cycle = { id: string; label: string; qualificationType: string };

type ThresholdDelta = Record<string, { from: number; to: number }>;

type SubjectComparison = {
  subject: string;
  gradeFormat: string;
  fromCount: number;
  toCount: number;
  fromMean: number | null;
  toMean: number | null;
  meanDelta: number | null;
  improved: number;
  declined: number;
  unchanged: number;
  thresholdDelta: ThresholdDelta;
  students: Array<{
    studentId: string;
    name: string;
    ppFlag: boolean;
    sendFlag: boolean;
    from: string | null;
    to: string | null;
    fromNorm: number | null;
    toNorm: number | null;
    delta: number | null;
  }>;
};

type ComparisonData = {
  fromPoint: Point;
  toPoint: Point;
  cycle: Cycle;
  summary: {
    avgDelta: number | null;
    totalImproved: number;
    totalDeclined: number;
    totalUnchanged: number;
    subjectsCompared: number;
  };
  subjects: SubjectComparison[];
};

type RankMovementEntry = {
  studentId: string;
  name: string;
  ppFlag: boolean;
  sendFlag: boolean;
  fromRank: number | null;
  toRank: number | null;
  rankChange: number | null;
  fromMean: number | null;
  toMean: number | null;
  meanChange: number | null;
};

type TeachingGroupShift = {
  subject: string;
  groups: Array<{ group: string; fromMean: number | null; toMean: number | null; delta: number | null }>;
};

type RankMovementData = {
  rankMovements: RankMovementEntry[];
  teachingGroupShifts: TeachingGroupShift[];
};

// ─── Icon helpers ─────────────────────────────────────────────────────────────

function IconTrendUp() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}

function IconTrendDown() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
      <polyline points="17 18 23 18 23 12" />
    </svg>
  );
}

function IconEqual() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="5" y1="9" x2="19" y2="9" />
      <line x1="5" y1="15" x2="19" y2="15" />
    </svg>
  );
}

function IconAvgChange() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="12" y1="20" x2="12" y2="4" />
      <polyline points="6 10 12 4 18 10" />
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function ThresholdArrow({ thr }: { thr: { from: number; to: number } | undefined }) {
  if (!thr) return <span className="text-[var(--on-surface-muted)]">—</span>;
  const up = thr.to > thr.from;
  const down = thr.to < thr.from;
  return (
    <span className="whitespace-nowrap">
      <span className="text-[var(--on-surface-muted)]">{thr.from}%</span>
      <span className="mx-0.5 text-[var(--on-surface-muted)]">→</span>
      <span className={up ? "font-semibold text-[var(--success)]" : down ? "font-semibold text-[var(--error)]" : "text-[var(--on-surface-muted)]"}>{thr.to}%</span>
    </span>
  );
}

type SortDir = "asc" | "desc";
type SortKey = "subject" | "improved" | "declined" | "avgChange";

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="ml-0.5 text-[10px] text-[var(--on-surface-muted)] opacity-60">↕</span>;
  return <span className="ml-0.5 text-[10px]">{dir === "asc" ? "↑" : "↓"}</span>;
}

// ─── Colour helpers ───────────────────────────────────────────────────────────

const POINT_TYPE_COLOURS: Record<string, string> = {
  ...pointTypePillClasses,
  BASELINE: "bg-[var(--surface-container)] text-[var(--on-surface-muted)]",
  OTHER: "bg-[var(--surface-container)] text-[var(--on-surface-muted)]",
};

const POINT_TYPE_LABELS: Record<string, string> = {
  BASELINE: "Baseline", INTERNAL_ASSESSMENT: "Internal Assessment",
  INTERNAL_MOCK: "Internal Mock", TEACHER_PREDICTION: "Teacher Prediction",
  EXTERNAL_FINAL: "External Final", OTHER: "Other",
};

function deltaCls(d: number | null): string {
  if (d === null) return "text-[var(--on-surface-muted)]";
  if (d > 0.02) return "text-[var(--success)] font-semibold";
  if (d < -0.02) return "text-[var(--error)] font-semibold";
  return "text-[var(--on-surface-muted)]";
}

function deltaLabel(d: number | null, fmt: string): string {
  if (d === null) return "—";
  if (fmt === "GCSE") {
    const g = Math.round(d * 9 * 10) / 10;
    return (g > 0 ? "+" : "") + g.toFixed(1) + " grade";
  }
  if (fmt === "A_LEVEL") {
    const g = Math.round(d * 7 * 10) / 10;
    return (g > 0 ? "+" : "") + g.toFixed(1) + " grade";
  }
  const pct = Math.round(d * 100 * 10) / 10;
  return (pct > 0 ? "+" : "") + pct.toFixed(1) + "pp";
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ComparisonPage() {
  const { cycleId } = useParams<{ cycleId: string }>();
  const searchParams = useSearchParams();

  const [cyclePoints, setCyclePoints] = useState<Point[]>([]);
  const [cycleLabel, setCycleLabel] = useState("");
  const [fromId, setFromId] = useState(searchParams.get("from") ?? "");
  const [toId, setToId] = useState(searchParams.get("to") ?? "");
  const [data, setData] = useState<ComparisonData | null>(null);
  const [rankData, setRankData] = useState<RankMovementData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("subject");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "subject" ? "asc" : "desc"); }
  }

  function sortedSubjects(subjects: SubjectComparison[]) {
    return [...subjects].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "subject") cmp = a.subject.localeCompare(b.subject);
      else if (sortKey === "improved") cmp = a.improved - b.improved;
      else if (sortKey === "declined") cmp = a.declined - b.declined;
      else if (sortKey === "avgChange") cmp = (a.meanDelta ?? 0) - (b.meanDelta ?? 0);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }

  const fromIdRef = React.useRef(fromId);
  const toIdRef = React.useRef(toId);

  useEffect(() => {
    fetch(`/api/assessments/cycles/${cycleId}`)
      .then((r) => r.json())
      .then(({ cycle }) => {
        if (!cycle) return;
        setCycleLabel(cycle.label ?? "");
        const pts = cycle.points ?? [];
        setCyclePoints(pts);
        if (!fromIdRef.current && pts.length >= 1) setFromId(pts[0].id);
        if (!toIdRef.current && pts.length >= 2) setToId(pts[pts.length - 1].id);
      })
      .catch(() => {});
  }, [cycleId]);

  const loadComparison = useCallback(async () => {
    if (!fromId || !toId || fromId === toId) return;
    setLoading(true);
    setError(null);
    setRankData(null);
    try {
      const res = await fetch(`/api/assessments/compare?fromPointId=${fromId}&toPointId=${toId}`);
      if (!res.ok) { const d = await res.json(); setError(d.error || "Failed to load comparison"); return; }
      const d = await res.json();
      setData(d);
      // Fetch rank movement for PERCENTAGE / RAW formats
      const fmt = d.subjects?.[0]?.gradeFormat;
      if (fmt === "PERCENTAGE" || fmt === "RAW") {
        const rRes = await fetch(`/api/assessments/compare/ranks?fromPointId=${fromId}&toPointId=${toId}`);
        if (rRes.ok) setRankData(await rRes.json());
      }
    } catch { setError("Failed to load comparison."); }
    finally { setLoading(false); }
  }, [fromId, toId]);

  useEffect(() => { loadComparison(); }, [loadComparison]);

  const isGcse = data?.subjects?.[0]?.gradeFormat === "GCSE";
  const isALevel = data?.subjects?.[0]?.gradeFormat === "A_LEVEL";

  const allStudentDeltas = data?.subjects?.flatMap((s) => s.students) ?? [];
  const topImprovers = [...allStudentDeltas]
    .filter((s) => s.delta !== null && s.delta > 0)
    .sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0))
    .slice(0, 10);
  const topDecliners = [...allStudentDeltas]
    .filter((s) => s.delta !== null && s.delta < 0)
    .sort((a, b) => (a.delta ?? 0) - (b.delta ?? 0))
    .slice(0, 10);

  return (
    <AttainmentPageShell>
      <AssessmentsBreadcrumb
        items={[
          { label: "Attainment", href: "/assessments" },
          { label: cycleLabel || "Cycle", href: `/assessments/${cycleId}` },
          { label: "Comparison" },
        ]}
      />

      <PageHeader variant="ledger"
        eyebrow="Attainment"
        title="Compare result points"
        subtitle="Track progress, accuracy, and movement between any two result points in this cycle."
      />

      {/* Point selectors */}
      <Card className="space-y-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5 items-end">
          <div className="sm:col-span-2 space-y-1">
            <label className="text-xs font-medium uppercase tracking-wide text-[var(--on-surface-muted)]">From</label>
            <select className="field w-full" value={fromId} onChange={(e) => setFromId(e.target.value)}>
              <option value="">Select point…</option>
              {cyclePoints.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>
          <div className="text-center text-lg text-[var(--on-surface-muted)] pb-1">→</div>
          <div className="sm:col-span-2 space-y-1">
            <label className="text-xs font-medium uppercase tracking-wide text-[var(--on-surface-muted)]">To</label>
            <select className="field w-full" value={toId} onChange={(e) => setToId(e.target.value)}>
              <option value="">Select point…</option>
              {cyclePoints.filter((p) => p.id !== fromId).map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>
        </div>

        {data && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${POINT_TYPE_COLOURS[data.fromPoint.pointType]}`}>
              {POINT_TYPE_LABELS[data.fromPoint.pointType]}
            </span>
            <span className="text-xs text-[var(--on-surface-muted)]">→</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${POINT_TYPE_COLOURS[data.toPoint.pointType]}`}>
              {POINT_TYPE_LABELS[data.toPoint.pointType]}
            </span>
            {data.toPoint.isFinalPoint && (
              <span className={finalPointChipClass}>
                Final point
              </span>
            )}
          </div>
        )}
      </Card>

      {error && <p className="text-sm text-[var(--error)]">{error}</p>}
      {loading && <p className="text-sm text-[var(--on-surface-muted)]">Loading comparison…</p>}

      {!loading && data && data.subjects.length === 0 && (
        <Card className="overflow-hidden p-0">
          <DataTableEmpty
            title="No overlap between these points"
            description="There are no shared subjects with data at both selected result points. Pick two points that have subject uploads, or add results first."
            action={
              <Link
                href={`/assessments/${cycleId}`}
                className="link-accent text-sm font-semibold underline-offset-2"
              >
                Back to cycle
              </Link>
            }
          />
        </Card>
      )}

      {!loading && data && data.subjects.length > 0 && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-4">
            {(() => {
              const avgDelta = data.summary.avgDelta;
              const avgUp = avgDelta !== null && avgDelta > 0;
              const avgDown = avgDelta !== null && avgDelta < 0;
              return [
                {
                  label: "Avg change",
                  value: avgDelta !== null ? deltaLabel(avgDelta, data.subjects[0]?.gradeFormat ?? "GCSE") : "—",
                  colour: avgUp ? "text-[var(--success)]" : avgDown ? "text-[var(--error)]" : "text-[var(--on-surface)]",
                  icon: <IconAvgChange />,
                  iconBg: avgUp ? "bg-[color-mix(in_srgb,var(--success)_12%,transparent)] text-[var(--success)]" : avgDown ? "bg-[color-mix(in_srgb,var(--error)_12%,transparent)] text-[var(--error)]" : "bg-[var(--surface-container)] text-[var(--on-surface-muted)]",
                },
                {
                  label: "Improved",
                  value: data.summary.totalImproved.toString(),
                  colour: "text-[var(--success)]",
                  icon: <IconTrendUp />,
                  iconBg: "bg-[color-mix(in_srgb,var(--success)_12%,transparent)] text-[var(--success)]",
                },
                {
                  label: "Declined",
                  value: data.summary.totalDeclined.toString(),
                  colour: "text-[var(--error)]",
                  icon: <IconTrendDown />,
                  iconBg: "bg-[color-mix(in_srgb,var(--error)_12%,transparent)] text-[var(--error)]",
                },
                {
                  label: "Unchanged",
                  value: data.summary.totalUnchanged.toString(),
                  colour: "text-[var(--on-surface-muted)]",
                  icon: <IconEqual />,
                  iconBg: "bg-[var(--surface-container)] text-[var(--on-surface-muted)]",
                },
              ].map(({ label, value, colour, icon, iconBg }) => (
                <div key={label} className="rounded-2xl bg-[var(--surface-container-lowest)] p-5 shadow-ambient">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconBg}`}>{icon}</span>
                  </div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--on-surface-muted)]">{label}</p>
                  <p className={`mt-1 text-2xl font-bold tabular-nums ${colour}`}>{value}</p>
                </div>
              ));
            })()}
          </div>

          {/* Subject comparison table */}
          <Card className="space-y-4">
            <SectionHeader title="Subject movement" subtitle="Click a subject to expand student-level detail" />
            <div className="table-shell border-0 rounded-none shadow-none">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="table-head-row">
                      <th className="px-5 py-3 text-left cursor-pointer select-none" onClick={() => toggleSort("subject")}>
                        Subject<SortIcon active={sortKey === "subject"} dir={sortDir} />
                      </th>
                      <th className="px-4 py-3 text-right">N</th>
                      <th className="px-4 py-3 text-right cursor-pointer select-none" onClick={() => toggleSort("improved")}>
                        Improved<SortIcon active={sortKey === "improved"} dir={sortDir} />
                      </th>
                      <th className="px-4 py-3 text-right cursor-pointer select-none" onClick={() => toggleSort("declined")}>
                        Declined<SortIcon active={sortKey === "declined"} dir={sortDir} />
                      </th>
                      {isGcse && (
                        <>
                          <th className="px-4 py-3 text-right">
                            4+
                            <br />
                            <span className="text-[9px] font-normal normal-case tracking-normal text-muted">from→to</span>
                          </th>
                          <th className="px-4 py-3 text-right">
                            5+
                            <br />
                            <span className="text-[9px] font-normal normal-case tracking-normal text-muted">from→to</span>
                          </th>
                          <th className="px-4 py-3 text-right">
                            7+
                            <br />
                            <span className="text-[9px] font-normal normal-case tracking-normal text-muted">from→to</span>
                          </th>
                        </>
                      )}
                      {isALevel && (
                        <>
                          <th className="px-4 py-3 text-right">
                            A+
                            <br />
                            <span className="text-[9px] font-normal normal-case tracking-normal text-muted">from→to</span>
                          </th>
                          <th className="px-4 py-3 text-right">
                            C+
                            <br />
                            <span className="text-[9px] font-normal normal-case tracking-normal text-muted">from→to</span>
                          </th>
                        </>
                      )}
                      <th className="px-5 py-3 text-right cursor-pointer select-none" onClick={() => toggleSort("avgChange")}>
                        Avg change<SortIcon active={sortKey === "avgChange"} dir={sortDir} />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedSubjects(data.subjects).map((sc) => {
                    const isExpanded = expandedSubject === sc.subject;
                    const thr4 = sc.thresholdDelta["4+"] as { from: number; to: number } | undefined;
                    const thr5 = sc.thresholdDelta["5+"] as { from: number; to: number } | undefined;
                    const thr7 = sc.thresholdDelta["7+"] as { from: number; to: number } | undefined;
                    const thrA = sc.thresholdDelta["A+"] as { from: number; to: number } | undefined;
                    const thrC = sc.thresholdDelta["C+"] as { from: number; to: number } | undefined;

                    return (
                      <>
                        <tr
                          key={sc.subject}
                          className="table-row calm-transition cursor-pointer"
                          onClick={() => setExpandedSubject(isExpanded ? null : sc.subject)}
                        >
                          <td className="px-5 py-3.5 pr-4 font-medium text-[var(--on-surface)]">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[var(--on-surface-muted)]">{isExpanded ? <ChevronDown /> : <ChevronRight />}</span>
                              {sc.subject}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 pr-3 text-right tabular-nums text-[var(--on-surface-muted)]">
                            {sc.toCount}
                          </td>
                          <td className="px-4 py-3.5 pr-3 text-right font-semibold tabular-nums text-[var(--success)]">
                            {sc.improved}
                          </td>
                          <td className="px-4 py-3.5 pr-3 text-right font-semibold tabular-nums text-[var(--error)]">
                            {sc.declined}
                          </td>
                          {isGcse && (
                            <>
                              <td className="px-4 py-3.5 pr-3 text-right tabular-nums text-xs"><ThresholdArrow thr={thr4} /></td>
                              <td className="px-4 py-3.5 pr-3 text-right tabular-nums text-xs"><ThresholdArrow thr={thr5} /></td>
                              <td className="px-4 py-3.5 pr-3 text-right tabular-nums text-xs"><ThresholdArrow thr={thr7} /></td>
                            </>
                          )}
                          {isALevel && (
                            <>
                              <td className="px-4 py-3.5 pr-3 text-right tabular-nums text-xs"><ThresholdArrow thr={thrA} /></td>
                              <td className="px-4 py-3.5 pr-3 text-right tabular-nums text-xs"><ThresholdArrow thr={thrC} /></td>
                            </>
                          )}
                          <td className={`px-5 py-3.5 text-right tabular-nums ${deltaCls(sc.meanDelta)}`}>
                            {deltaLabel(sc.meanDelta, sc.gradeFormat)}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${sc.subject}-expanded`}>
                            <td colSpan={99} className="bg-surface-container-low p-4">
                              <div className="max-h-64 overflow-y-auto">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-[9px] font-semibold uppercase tracking-wide text-[var(--on-surface-muted)]">
                                      <th className="pb-1.5 pr-3 text-left">Student</th>
                                      <th className="pb-1.5 pr-3 text-center">From</th>
                                      <th className="pb-1.5 pr-3 text-center">To</th>
                                      <th className="pb-1.5 text-right">Change</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-[var(--outline-variant)]/20">
                                    {[...sc.students].sort((a, b) => Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0)).map((s) => (
                                      <tr key={s.studentId}>
                                        <td className="py-1 pr-3 text-[var(--on-surface)]">
                                          {s.name}
                                          {s.ppFlag && <span className={`ml-1 ${ppInlineBadgeClassLg}`}>PP</span>}
                                          {s.sendFlag && <span className={`ml-1 ${sendInlineBadgeClassLg}`}>SEND</span>}
                                        </td>
                                        <td className="py-1 pr-3 text-center font-semibold text-[var(--on-surface-muted)]">{s.from ?? "—"}</td>
                                        <td className="py-1 pr-3 text-center font-semibold text-[var(--on-surface)]">{s.to ?? "—"}</td>
                                        <td className={`py-1 text-right font-bold ${deltaCls(s.delta)}`}>
                                          {deltaLabel(s.delta, sc.gradeFormat)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
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
            </div>
          </Card>

          {/* Rank movement (PERCENTAGE / RAW) */}
          {rankData && rankData.rankMovements.length > 0 && (
            <>
              <Card className="space-y-4">
                <SectionHeader
                  title="Rank Movement"
                  subtitle="Overall rank based on mean score across all subjects. Positive = moved up."
                />
                <div className="grid grid-cols-2 gap-4">
                  {[
                    {
                      title: "Biggest rank rises",
                      students: rankData.rankMovements.filter((r) => (r.rankChange ?? 0) > 0).slice(0, 10),
                      positive: true,
                    },
                    {
                      title: "Biggest rank falls",
                      students: [...rankData.rankMovements]
                        .filter((r) => (r.rankChange ?? 0) < 0)
                        .sort((a, b) => (a.rankChange ?? 0) - (b.rankChange ?? 0))
                        .slice(0, 10),
                      positive: false,
                    },
                  ].map(({ title, students, positive }) => (
                    <div key={title}>
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[var(--on-surface-muted)]">{title}</p>
                      {students.length === 0 ? (
                        <p className="text-xs text-[var(--on-surface-muted)]">None</p>
                      ) : (
                        <div className="space-y-1.5">
                          {students.map((s) => (
                            <div key={s.studentId} className="flex items-center gap-2">
                              <Link
                                href={`/students/${s.studentId}`}
                                className="link-to-accent calm-transition flex-1 min-w-0 truncate text-sm"
                              >
                                {s.name}
                                {s.ppFlag && <span className={`ml-1 ${ppInlineBadgeClassLg}`}>PP</span>}
                                {s.sendFlag && <span className={`ml-1 ${sendInlineBadgeClassLg}`}>SEN</span>}
                              </Link>
                              <span className="shrink-0 text-xs text-[var(--on-surface-muted)] tabular-nums">
                                #{s.fromRank} → #{s.toRank}
                              </span>
                              <span className={`shrink-0 w-14 text-right text-sm font-bold tabular-nums ${positive ? "text-[var(--success)]" : "text-[var(--error)]"}`}>
                                {s.rankChange !== null ? (positive ? `▲${s.rankChange}` : `▼${Math.abs(s.rankChange)}`) : "—"}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>

              {/* Teaching group shift (only shown when teacher data exists) */}
              {rankData.teachingGroupShifts.length > 0 && (
                <Card className="space-y-4">
                  <SectionHeader
                    title="Class Performance Shift"
                    subtitle="Mean % change per teaching group between the two points"
                  />
                  <div className="space-y-5">
                    {rankData.teachingGroupShifts.map((shift) => (
                      <div key={shift.subject}>
                        <p className="mb-2 text-xs font-semibold text-[var(--on-surface)]">{shift.subject}</p>
                        <div className="space-y-1.5">
                          {shift.groups.map((g) => (
                            <div key={g.group} className="flex items-center gap-3">
                              <span className="w-32 truncate text-xs text-[var(--on-surface-muted)]">{g.group}</span>
                              <span className="w-12 text-right text-xs tabular-nums text-[var(--on-surface-muted)]">
                                {g.fromMean !== null ? `${g.fromMean}%` : "—"}
                              </span>
                              <span className="text-[var(--on-surface-muted)]">→</span>
                              <span className="w-12 text-right text-xs font-semibold tabular-nums text-[var(--on-surface)]">
                                {g.toMean !== null ? `${g.toMean}%` : "—"}
                              </span>
                              <span className={`w-16 text-right text-xs font-bold tabular-nums ${g.delta === null ? "" : g.delta > 0 ? "text-[var(--success)]" : g.delta < 0 ? "text-[var(--error)]" : "text-[var(--on-surface-muted)]"}`}>
                                {g.delta !== null ? `${g.delta > 0 ? "+" : ""}${g.delta}pp` : "—"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </>
          )}

          {/* Top improvers / decliners */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { title: "Top Improvers", students: topImprovers, valueCls: "text-[var(--success)]", icon: <IconTrendUp />, iconBg: "bg-[color-mix(in_srgb,var(--success)_12%,transparent)] text-[var(--success)]" },
              { title: "Biggest Declines", students: topDecliners, valueCls: "text-[var(--error)]", icon: <IconTrendDown />, iconBg: "bg-[color-mix(in_srgb,var(--error)_12%,transparent)] text-[var(--error)]" },
            ].map(({ title, students, valueCls, icon, iconBg }) => (
              <div key={title} className="rounded-2xl border border-[var(--outline-variant)]/60 bg-[var(--surface-container-lowest)] p-6 shadow-ambient">
                <div className="flex items-center gap-3 mb-5">
                  <span className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${iconBg}`}>{icon}</span>
                  <h3 className="text-xl font-bold text-[var(--on-surface)]">{title}</h3>
                </div>
                {students.length === 0 ? (
                  <p className="text-xs text-[var(--on-surface-muted)]">None</p>
                ) : (
                  <div>
                    {students.map((s, i) => (
                      <div key={`${s.studentId}-${s.from}`} className="flex items-center gap-3 border-b border-[var(--outline-variant)]/20 py-2.5 last:border-0">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--surface-container)] text-[11px] font-bold tabular-nums text-[var(--on-surface-muted)]">{i + 1}</span>
                        <Link href={`/students/${s.studentId}`} className="link-to-accent calm-transition min-w-0 flex-1 truncate text-sm font-medium">{s.name}</Link>
                        <span className={`shrink-0 text-sm font-bold tabular-nums ${valueCls}`}>{s.from} → {s.to}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </AttainmentPageShell>
  );
}
