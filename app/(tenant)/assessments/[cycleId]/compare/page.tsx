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
import type { PointType, ResultStatus } from "@prisma/client";

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

// ─── Colour helpers ───────────────────────────────────────────────────────────

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
    <div className="w-full space-y-8 pb-16">
      <AssessmentsBreadcrumb
        items={[
          { label: "Attainment", href: "/assessments" },
          { label: cycleLabel || "Cycle", href: `/assessments/${cycleId}` },
          { label: "Comparison" },
        ]}
      />

      <PageHeader
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
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
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
            {[
              { label: "Avg change", value: data.summary.avgDelta !== null ? deltaLabel(data.summary.avgDelta, data.subjects[0]?.gradeFormat ?? "GCSE") : "—", colour: data.summary.avgDelta !== null && data.summary.avgDelta > 0 ? "text-[var(--success)]" : data.summary.avgDelta !== null && data.summary.avgDelta < 0 ? "text-[var(--error)]" : "text-[var(--on-surface)]" },
              { label: "Improved", value: data.summary.totalImproved.toString(), colour: "text-[var(--success)]" },
              { label: "Declined", value: data.summary.totalDeclined.toString(), colour: "text-[var(--error)]" },
              { label: "Unchanged", value: data.summary.totalUnchanged.toString(), colour: "text-[var(--on-surface-muted)]" },
            ].map(({ label, value, colour }) => (
              <div key={label} className="rounded-xl bg-[var(--surface)] p-4 shadow-ambient ring-1 ring-[var(--outline-variant)]/30">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--on-surface-muted)]">{label}</p>
                <p className={`mt-1 text-2xl font-bold tabular-nums ${colour}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Subject comparison table */}
          <Card className="space-y-4">
            <SectionHeader title="Subject movement" subtitle="Click a subject to expand student-level detail" />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--outline-variant)]/30 text-[10px] font-semibold uppercase tracking-wider text-[var(--on-surface-muted)]">
                    <th className="pb-2 pr-4 text-left">Subject</th>
                    <th className="pb-2 pr-3 text-right">N</th>
                    <th className="pb-2 pr-3 text-right">Improved</th>
                    <th className="pb-2 pr-3 text-right">Declined</th>
                    {isGcse && (
                      <>
                        <th className="pb-2 pr-3 text-right">4+<br /><span className="text-[8px] font-normal normal-case">from→to</span></th>
                        <th className="pb-2 pr-3 text-right">5+<br /><span className="text-[8px] font-normal normal-case">from→to</span></th>
                        <th className="pb-2 pr-3 text-right">7+<br /><span className="text-[8px] font-normal normal-case">from→to</span></th>
                      </>
                    )}
                    {isALevel && (
                      <>
                        <th className="pb-2 pr-3 text-right">A+<br /><span className="text-[8px] font-normal normal-case">from→to</span></th>
                        <th className="pb-2 pr-3 text-right">C+<br /><span className="text-[8px] font-normal normal-case">from→to</span></th>
                      </>
                    )}
                    <th className="pb-2 text-right">Avg change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--outline-variant)]/20">
                  {data.subjects.sort((a, b) => a.subject.localeCompare(b.subject)).map((sc) => {
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
                          className="cursor-pointer hover:bg-[var(--surface-container-low)]"
                          onClick={() => setExpandedSubject(isExpanded ? null : sc.subject)}
                        >
                          <td className="py-2.5 pr-4 font-medium text-[var(--on-surface)]">
                            {sc.subject}
                            <span className="ml-1 text-[10px] text-[var(--on-surface-muted)]">{isExpanded ? "▲" : "▼"}</span>
                          </td>
                          <td className="py-2.5 pr-3 text-right tabular-nums text-[var(--on-surface-muted)]">
                            {sc.toCount}
                          </td>
                          <td className="py-2.5 pr-3 text-right font-semibold tabular-nums text-[var(--success)]">
                            {sc.improved}
                          </td>
                          <td className="py-2.5 pr-3 text-right font-semibold tabular-nums text-[var(--error)]">
                            {sc.declined}
                          </td>
                          {isGcse && (
                            <>
                              <td className="py-2.5 pr-3 text-right tabular-nums text-xs">
                                {thr4 ? <><span className="text-[var(--on-surface-muted)]">{thr4.from}%</span><span className="text-[var(--on-surface-muted)]">→</span><span className={thr4.to > thr4.from ? "text-[var(--success)] font-bold" : thr4.to < thr4.from ? "text-[var(--error)] font-bold" : ""}>{thr4.to}%</span></> : "—"}
                              </td>
                              <td className="py-2.5 pr-3 text-right tabular-nums text-xs">
                                {thr5 ? <><span className="text-[var(--on-surface-muted)]">{thr5.from}%</span><span className="text-[var(--on-surface-muted)]">→</span><span className={thr5.to > thr5.from ? "text-[var(--success)] font-bold" : thr5.to < thr5.from ? "text-[var(--error)] font-bold" : ""}>{thr5.to}%</span></> : "—"}
                              </td>
                              <td className="py-2.5 pr-3 text-right tabular-nums text-xs">
                                {thr7 ? <><span className="text-[var(--on-surface-muted)]">{thr7.from}%</span><span className="text-[var(--on-surface-muted)]">→</span><span className={thr7.to > thr7.from ? "text-[var(--success)] font-bold" : thr7.to < thr7.from ? "text-[var(--error)] font-bold" : ""}>{thr7.to}%</span></> : "—"}
                              </td>
                            </>
                          )}
                          {isALevel && (
                            <>
                              <td className="py-2.5 pr-3 text-right tabular-nums text-xs">
                                {thrA ? <><span className="text-[var(--on-surface-muted)]">{thrA.from}%</span>→<span className={thrA.to > thrA.from ? "text-[var(--success)] font-bold" : thrA.to < thrA.from ? "text-[var(--error)] font-bold" : ""}>{thrA.to}%</span></> : "—"}
                              </td>
                              <td className="py-2.5 pr-3 text-right tabular-nums text-xs">
                                {thrC ? <><span className="text-[var(--on-surface-muted)]">{thrC.from}%</span>→<span className={thrC.to > thrC.from ? "text-[var(--success)] font-bold" : thrC.to < thrC.from ? "text-[var(--error)] font-bold" : ""}>{thrC.to}%</span></> : "—"}
                              </td>
                            </>
                          )}
                          <td className={`py-2.5 text-right tabular-nums ${deltaCls(sc.meanDelta)}`}>
                            {deltaLabel(sc.meanDelta, sc.gradeFormat)}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${sc.subject}-expanded`}>
                            <td colSpan={99} className="bg-[var(--surface-container-low)] p-4">
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
                                    {sc.students.map((s) => (
                                      <tr key={s.studentId}>
                                        <td className="py-1 pr-3 text-[var(--on-surface)]">
                                          {s.name}
                                          {s.ppFlag && <span className="ml-1 rounded-full bg-violet-100 px-1.5 text-[9px] text-violet-700">PP</span>}
                                          {s.sendFlag && <span className="ml-1 rounded-full bg-blue-100 px-1.5 text-[9px] text-blue-700">SEND</span>}
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
                                {s.ppFlag && <span className="ml-1 rounded-full bg-violet-100 px-1.5 text-[9px] text-violet-700">PP</span>}
                                {s.sendFlag && <span className="ml-1 rounded-full bg-blue-100 px-1.5 text-[9px] text-blue-700">SEN</span>}
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
              { title: "Top improvers", students: topImprovers, cls: "text-[var(--success)]" },
              { title: "Biggest declines", students: topDecliners, cls: "text-[var(--error)]" },
            ].map(({ title, students, cls }) => (
              <Card key={title} className="space-y-3">
                <SectionHeader title={title} />
                {students.length === 0 ? (
                  <p className="text-xs text-[var(--on-surface-muted)]">None</p>
                ) : (
                  <div className="space-y-1.5">
                    {students.map((s) => (
                      <div key={`${s.studentId}-${s.from}`} className="flex items-center justify-between gap-2">
                        <Link
                          href={`/students/${s.studentId}`}
                          className="link-to-accent calm-transition min-w-0 truncate text-sm"
                        >
                          {s.name}
                        </Link>
                        <span className={`text-sm font-bold tabular-nums ${cls} shrink-0`}>
                          {s.from} → {s.to}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
