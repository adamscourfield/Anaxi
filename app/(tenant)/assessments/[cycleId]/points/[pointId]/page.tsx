"use client";

/**
 * Result Point Detail — Single-Point Analysis
 *
 * Shows comprehensive attainment analysis for one result point.
 * Adapts to GCSE (numeric 1-9) vs A-Level (A*-U) dominant format.
 */

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
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
  send: { count: number; t4: number; nonSendT4: number; gap4: number } | null;
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
  | { type: 'SUBJECT', subject: string, students: StudentResult[] }
  | { type: 'EM', label: string, students: EMStudentResult[], target: number }
  | { type: 'GRADE', subject: string, grade: string, students: StudentResult[] }
  | null;

type ALevelSummary = {
  total: number; aStarPct: number; aPct: number; bPct: number; cPlusPct: number;
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

function gcseColour(g: string | number): string {
  const n = Number(g);
  if (n >= 8) return "bg-emerald-600 text-white";
  if (n >= 7) return "bg-green-500 text-white";
  if (n >= 6) return "bg-blue-500 text-slate-900";
  if (n >= 5) return "bg-violet-500 text-white";
  if (n >= 4) return "bg-amber-500 text-slate-900";
  if (n >= 3) return "bg-orange-500 text-white";
  return "bg-red-600 text-white";
}

function aLevelColour(g: string): string {
  switch (g.toUpperCase()) {
    case "A*": return "bg-emerald-600 text-white";
    case "A":  return "bg-green-500 text-white";
    case "B":  return "bg-blue-500 text-white";
    case "C":  return "bg-violet-500 text-white";
    case "D":  return "bg-amber-500 text-white";
    case "E":  return "bg-orange-500 text-white";
    default:   return "bg-red-700 text-white";
  }
}

function gapCls(gap: number) {
  if (gap <= 5) return "text-[var(--success)]";
  if (gap <= 15) return "text-[var(--warning)]";
  return "text-[var(--error)]";
}

function PctBar({ pct, cls }: { pct: number; cls: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-container)]">
        <div className={`absolute inset-y-0 left-0 rounded-full ${cls}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className="w-9 text-right text-sm font-bold tabular-nums">{pct}%</span>
    </div>
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
          const cls = format === "GCSE" ? gcseColour(d.grade) : aLevelColour(d.grade);
          return (
            <div key={d.grade} className={`flex items-center justify-center text-[9px] font-bold ${cls} ${onGradeClick ? 'cursor-pointer hover:opacity-80' : ''}`}
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
          const cls = format === "GCSE" ? gcseColour(d.grade) : aLevelColour(d.grade);
          return (
            <button type="button" key={d.grade} className={`flex items-center gap-1 text-[9px] text-[var(--on-surface-muted)] ${onGradeClick ? 'hover:text-[var(--on-surface)] cursor-pointer' : ''}`}
                    onClick={() => onGradeClick && onGradeClick(d.grade)}>
              <span className={`inline-block h-2 w-2 rounded-sm ${cls}`} />
              {d.grade}: {d.count} ({pct}%)
            </button>
          );
        })}
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalView, setModalView] = useState<ModalView>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [ptRes, mRes] = await Promise.all([
          fetch(`/api/assessments/points/${pointId}`),
          fetch(`/api/assessments/metrics?pointId=${pointId}`),
        ]);
        if (ptRes.ok) { const { point: p } = await ptRes.json(); setPoint(p); }
        if (mRes.ok) { const m = await mRes.json(); setMetrics(m); }
        else setError("Failed to load metrics.");
      } catch { setError("Failed to load data."); }
      finally { setLoading(false); }
    }
    load();
  }, [pointId]);

  const isGcse = metrics?.dominantFormat === "GCSE";
  const isALevel = metrics?.dominantFormat === "A_LEVEL";

  if (loading) {
    return <div className="w-full py-16 text-center text-sm text-[var(--on-surface-muted)]">Loading…</div>;
  }

  return (
    <div className="w-full space-y-7">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[var(--on-surface-muted)]">
        <Link href="/assessments" className="hover:underline">Cycles</Link>
        <span>›</span>
        <Link href={`/assessments/${cycleId}`} className="hover:underline">{point?.cycle.label ?? "Cycle"}</Link>
        <span>›</span>
        <span className="text-[var(--on-surface)]">{point?.label ?? "Result point"}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          {point && (
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${POINT_TYPE_COLOURS[point.pointType]}`}>
                {POINT_TYPE_LABELS[point.pointType]}
              </span>
              <span className="rounded-full bg-[var(--surface-container)] px-2 py-0.5 text-[10px] font-semibold text-[var(--on-surface-muted)]">
                {STATUS_LABELS[point.resultStatus]}
              </span>
              {point.isFinalPoint && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  Final
                </span>
              )}
            </div>
          )}
          <PageHeader title={point?.label ?? "Result point"} />
        </div>
        <div className="flex gap-2 shrink-0">
          {point?.resultStatus !== "LOCKED" && (
            <Link
              href={`/assessments/${cycleId}/points/${pointId}/upload`}
              className="rounded-lg border border-[var(--outline-variant)] px-3 py-1.5 text-sm text-[var(--on-surface)] hover:bg-[var(--surface-container-low)]"
            >
              Upload results
            </Link>
          )}
          <Link
            href={`/assessments/${cycleId}/compare?from=${pointId}`}
            className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
          >
            Compare →
          </Link>
        </div>
      </div>

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
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Students assessed", value: metrics.totalStudents },
              { label: "Grade entries", value: metrics.totalEntries.toLocaleString() },
              { label: "Subjects", value: metrics.subjects.length },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl bg-[var(--surface)] p-4 shadow-sm ring-1 ring-[var(--outline-variant)]/30">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--on-surface-muted)]">{label}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--on-surface)]">{value}</p>
              </div>
            ))}
          </div>

          {/* GCSE Basics */}
          {isGcse && metrics.gcseBasics && (
            <Card className="space-y-5">
              <SectionHeader title="English & Maths — Headline Measures" subtitle="Both subjects must meet threshold" />
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "E&M 4+", val: metrics.gcseBasics.em4, cls: "bg-amber-500", st: metrics.gcseBasics.students4, target: 4 },
                  { label: "E&M 5+", val: metrics.gcseBasics.em5, cls: "bg-violet-500", st: metrics.gcseBasics.students5, target: 5 },
                  { label: "E&M 7+", val: metrics.gcseBasics.em7, cls: "bg-green-500", st: metrics.gcseBasics.students7, target: 7 },
                ].map(({ label, val, cls, st, target }) => (
                  <div key={label} 
                       className="rounded-xl bg-[var(--surface-container-low)] p-4 cursor-pointer hover:ring-2 ring-[var(--accent)] transition-all"
                       onClick={() => setModalView({ type: 'EM', label, students: st, target })}>
                    <p className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-[var(--on-surface-muted)]">
                      {label}
                      <span className="text-[var(--accent)] underline lowercase hover:no-underline">view students</span>
                    </p>
                    <p className="mt-0.5 text-3xl font-bold tabular-nums text-[var(--on-surface)]">{val}%</p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-container)]">
                      <div className={`h-full rounded-full ${cls}`} style={{ width: `${val}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* PP gap */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "PP Gap — 4+ threshold", pp: metrics.gcseBasics.ppEm4, nonPp: metrics.gcseBasics.nonPpEm4, gap: metrics.gcseBasics.gap4 },
                  { label: "PP Gap — 5+ threshold", pp: metrics.gcseBasics.ppEm5, nonPp: metrics.gcseBasics.nonPpEm5, gap: metrics.gcseBasics.gap5 },
                ].map(({ label, pp, nonPp, gap }) => (
                  <div key={label} className="rounded-xl bg-[var(--surface-container-low)] p-4 space-y-2">
                    <p className="text-xs font-medium text-[var(--on-surface-muted)]">{label}</p>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs"><span className="text-[var(--on-surface-muted)]">Non-PP</span><span className="font-bold">{nonPp}%</span></div>
                      <PctBar pct={nonPp} cls="bg-[var(--accent)]" />
                      <div className="flex justify-between text-xs"><span className="text-[var(--on-surface-muted)]">PP</span><span className="font-bold">{pp}%</span></div>
                      <PctBar pct={pp} cls="bg-violet-400" />
                      <div className={`flex justify-between text-xs font-bold ${gapCls(gap)}`}>
                        <span>Gap</span><span>{gap > 0 ? "+" : ""}{gap}pp</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
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
          <Card className="space-y-4">
            <SectionHeader title="Subject Breakdown" subtitle={`${metrics.subjects.length} subjects`} />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--outline-variant)]/30 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--on-surface-muted)]">
                    <th className="pb-2 pr-4">Subject</th>
                    <th className="pb-2 pr-3 text-right">N</th>
                    {isGcse && (
                      <>
                        <th className="pb-2 pr-3 text-right text-amber-600">4+</th>
                        <th className="pb-2 pr-3 text-right text-violet-600">5+</th>
                        <th className="pb-2 pr-3 text-right text-green-600">7+</th>
                      </>
                    )}
                    {isALevel && (
                      <>
                        <th className="pb-2 pr-3 text-right text-emerald-600">A*</th>
                        <th className="pb-2 pr-3 text-right text-green-600">A+</th>
                        <th className="pb-2 pr-3 text-right text-blue-600">B+</th>
                        <th className="pb-2 pr-3 text-right text-violet-600">C+</th>
                      </>
                    )}
                    <th className="pb-2">Distribution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--outline-variant)]/20">
                  {metrics.subjects.sort((a, b) => a.subject.localeCompare(b.subject)).map((sm) => (
                    <tr key={sm.subject} className="group">
                      <td className="py-3 pr-4 font-medium text-[var(--on-surface)]">
                        <button onClick={() => setModalView({ type: 'SUBJECT', subject: sm.subject, students: sm.students })} className="text-[var(--accent)] hover:underline text-left">
                          {sm.subject}
                        </button>
                      </td>
                      <td className="py-3 pr-3 text-right tabular-nums text-[var(--on-surface-muted)]">{sm.presentCount}</td>
                      {isGcse && (
                        <>
                          <td className="py-3 pr-3 text-right font-semibold tabular-nums text-amber-600">{sm.thresholds["4+"]}%</td>
                          <td className="py-3 pr-3 text-right font-semibold tabular-nums text-violet-600">{sm.thresholds["5+"]}%</td>
                          <td className="py-3 pr-3 text-right font-semibold tabular-nums text-green-600">{sm.thresholds["7+"]}%</td>
                        </>
                      )}
                      {isALevel && (
                        <>
                          <td className="py-3 pr-3 text-right font-semibold tabular-nums text-emerald-600">{sm.thresholds["A*"]}%</td>
                          <td className="py-3 pr-3 text-right font-semibold tabular-nums text-green-600">{sm.thresholds["A+"]}%</td>
                          <td className="py-3 pr-3 text-right font-semibold tabular-nums text-blue-600">{sm.thresholds["B+"]}%</td>
                          <td className="py-3 pr-3 text-right font-semibold tabular-nums text-violet-600">{sm.thresholds["C+"]}%</td>
                        </>
                      )}
                      <td className="py-3 min-w-[160px]">
                        <DistBar 
                          distribution={sm.distribution} 
                          format={sm.gradeFormat} 
                          onGradeClick={(grade) => setModalView({ type: 'GRADE', subject: sm.subject, grade, students: sm.students.filter(s => s.rawValue === grade) })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* PP gap table (GCSE) */}
          {isGcse && metrics.subjects.some((sm) => sm.pp) && (
            <Card className="space-y-4">
              <SectionHeader title="Pupil Premium Gap by Subject" subtitle="4+ threshold — percentage-point gap between Non-PP and PP" />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--outline-variant)]/30 text-[10px] font-semibold uppercase tracking-wider text-[var(--on-surface-muted)]">
                      <th className="pb-2 pr-4 text-left">Subject</th>
                      <th className="pb-2 pr-3 text-right">Non-PP 4+</th>
                      <th className="pb-2 pr-3 text-right">PP 4+</th>
                      <th className="pb-2 pr-3 text-right">Gap</th>
                      <th className="pb-2 pr-3 text-right">Non-PP 5+</th>
                      <th className="pb-2 pr-3 text-right">PP 5+</th>
                      <th className="pb-2 text-right">Gap</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--outline-variant)]/20">
                    {metrics.subjects
                      .filter((sm) => sm.pp)
                      .sort((a, b) => (b.pp?.gap4 ?? 0) - (a.pp?.gap4 ?? 0))
                      .map((sm) => (
                        <tr key={sm.subject}>
                          <td className="py-2.5 pr-4 font-medium">{sm.subject}</td>
                          <td className="py-2.5 pr-3 text-right tabular-nums text-[var(--accent)]">{sm.pp!.nonPpT4}%</td>
                          <td className="py-2.5 pr-3 text-right tabular-nums text-violet-500">{sm.pp!.t4}%</td>
                          <td className={`py-2.5 pr-3 text-right font-bold tabular-nums ${gapCls(sm.pp!.gap4)}`}>
                            {sm.pp!.gap4 > 0 ? "+" : ""}{sm.pp!.gap4}pp
                          </td>
                          <td className="py-2.5 pr-3 text-right tabular-nums text-[var(--accent)]">{sm.pp!.nonPpT5}%</td>
                          <td className="py-2.5 pr-3 text-right tabular-nums text-violet-500">{sm.pp!.t5}%</td>
                          <td className={`py-2.5 text-right font-bold tabular-nums ${gapCls(sm.pp!.gap5)}`}>
                            {sm.pp!.gap5 > 0 ? "+" : ""}{sm.pp!.gap5}pp
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
          {/* SEND gap table (GCSE) */}
          {isGcse && metrics.subjects.some((sm) => sm.send) && (
            <Card className="space-y-4">
              <SectionHeader title="SEND Gap by Subject" subtitle="4+ threshold — percentage-point gap between Non-SEND and SEND" />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--outline-variant)]/30 text-[10px] font-semibold uppercase tracking-wider text-[var(--on-surface-muted)]">
                      <th className="pb-2 pr-4 text-left">Subject</th>
                      <th className="pb-2 pr-3 text-right">Non-SEND 4+</th>
                      <th className="pb-2 pr-3 text-right">SEND 4+</th>
                      <th className="pb-2 text-right">Gap</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--outline-variant)]/20">
                    {metrics.subjects
                      .filter((sm) => sm.send)
                      .sort((a, b) => (b.send?.gap4 ?? 0) - (a.send?.gap4 ?? 0))
                      .map((sm) => (
                        <tr key={sm.subject}>
                          <td className="py-2.5 pr-4 font-medium">{sm.subject}</td>
                          <td className="py-2.5 pr-3 text-right tabular-nums text-[var(--accent)]">{sm.send!.nonSendT4}%</td>
                          <td className="py-2.5 pr-3 text-right tabular-nums text-violet-500">{sm.send!.t4}%</td>
                          <td className={`py-2.5 text-right font-bold tabular-nums ${gapCls(sm.send!.gap4)}`}>
                            {sm.send!.gap4 > 0 ? "+" : ""}{sm.send!.gap4}pp
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Modal overlay */}
      {modalView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-[var(--surface)] text-[var(--on-surface)] rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col border border-[var(--outline-variant)]/50">
            <div className="flex items-center justify-between p-4 border-b border-[var(--outline-variant)]/20">
              <h2 className="text-lg font-bold">
                {modalView.type === 'SUBJECT' ? `Students for ${modalView.subject}` : modalView.type === 'GRADE' ? `Students scoring ${modalView.grade} in ${modalView.subject}` : `E&M Baseline: ${modalView.label} Students`}
              </h2>
              <button 
                onClick={() => setModalView(null)} 
                className="text-[var(--on-surface-muted)] hover:text-[var(--on-surface)] p-2 rounded-lg hover:bg-[var(--surface-container)] transition-colors"
                aria-label="Close modal">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            
            <div className="p-0 overflow-y-auto flex-1">
              {modalView.type === 'SUBJECT' && (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-[var(--surface)] border-b border-[var(--outline-variant)]/20 shadow-sm z-10">
                    <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--on-surface-muted)]">
                      <th className="p-3 pl-4">Student</th>
                      <th className="p-3">Grade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--outline-variant)]/10">
                    {modalView.students.sort((a, b) => {
                       if (a.score !== b.score) return (b.score ?? -1) - (a.score ?? -1);
                       return a.name.localeCompare(b.name);
                    }).map(st => (
                      <tr key={st.studentId} className="hover:bg-[var(--surface-container-low)]/50 transition-colors">
                        <td className="p-3 pl-4 font-medium">{st.name}</td>
                        <td className="p-3 font-semibold text-[var(--accent)]">{st.rawValue}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

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
                        <td className="p-3 pl-4 font-medium">{st.name}</td>
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
                          <td className="p-3 pl-4 font-medium">{st.name}</td>
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
