"use client";

import { useState } from "react";
import Link from "next/link";
import { SectionHeader } from "@/components/ui/section-header";
import type { GradeFormat } from "@prisma/client";
import { percentileCellClass, gcseNumericCellClass, aLevelLetterCellClass } from "@/lib/assessments/chartColours";
import {
  gcseGradeBadgeClass,
  aLevelGradeBadgeClass,
  pctScoreBadgeClass,
  pctBandBarStyle,
  gradeDistributionBarStyle,
  thresholdHeaderGcse,
} from "@/modules/assessments/attainmentColours";

export type DistributionModalStudentRow = {
  id: string;
  name: string;
  rawValue: string;
  /** Percentage scale 0–100 when isPercentage; used for score badge colour */
  score: number | null;
  avg: number | null;
  isGcse: boolean;
  isPercentage: boolean;
};

type GradeDistEntry = { grade: string; count: number };
type PctDistEntry = { band: string; from: number; to: number; count: number };
type PctThreshold = { label: string; count: number; pct: number };

function gcseColour(g: string | number | null): string {
  return gcseGradeBadgeClass(g);
}

function aLevelColour(g: string): string {
  return aLevelGradeBadgeClass(g);
}

function pctColour(score: number): string {
  return pctScoreBadgeClass(score);
}

function pctBandDistributionStyle(from: number, to: number): { bar: string; swatch: string } {
  return pctBandBarStyle(from, to);
}

function avgDisplay(row: DistributionModalStudentRow): string {
  if (row.avg === null) return "—";
  if (row.isPercentage) return `${row.avg}%`;
  return row.avg.toFixed(1);
}

type ModalState =
  | { kind: "grade"; grade: string; students: DistributionModalStudentRow[] }
  | { kind: "band"; band: string; students: DistributionModalStudentRow[] }
  | null;

export function SubjectDistributionSection({
  subjectName,
  assessmentGradeFormat,
  isGcse,
  isPercentage,
  distTotal,
  pctDistTotal,
  distribution,
  pctDistribution,
  pctThresholds,
  gradeBuckets,
  pctBuckets,
}: {
  subjectName: string;
  assessmentGradeFormat: GradeFormat;
  isGcse: boolean;
  isPercentage: boolean;
  distTotal: number;
  pctDistTotal: number;
  distribution: GradeDistEntry[];
  pctDistribution: PctDistEntry[];
  pctThresholds: PctThreshold[];
  gradeBuckets: Record<string, DistributionModalStudentRow[]> | null;
  pctBuckets: Record<string, DistributionModalStudentRow[]> | null;
}) {
  const [modal, setModal] = useState<ModalState>(null);

  const openGrade = (grade: string) => {
    if (!gradeBuckets) return;
    const students = gradeBuckets[grade] ?? [];
    if (students.length === 0) return;
    setModal({ kind: "grade", grade, students });
  };

  const openBand = (band: string) => {
    if (!pctBuckets) return;
    const students = pctBuckets[band] ?? [];
    if (students.length === 0) return;
    setModal({ kind: "band", band, students });
  };

  const scoreColumnLabel =
    isPercentage && assessmentGradeFormat === "RAW" ? "Score (raw)" : isPercentage ? "Score" : "Grade";

  return (
    <>
      {isPercentage && pctDistTotal > 0 && (
        <div className="space-y-3">
          <SectionHeader title="Score Distribution" subtitle={`${pctDistTotal} students`} />
          <div className="rounded-2xl bg-[var(--surface-container-lowest)] p-6 shadow-ambient space-y-5">
            <div className="flex h-10 gap-0.5 overflow-hidden rounded-lg">
              {pctDistribution.map((d) => {
                if (d.count === 0) return null;
                const pct = (d.count / pctDistTotal) * 100;
                const { bar } = pctBandDistributionStyle(d.from, d.to);
                return (
                  <button
                    key={d.band}
                    type="button"
                    className={`flex items-center justify-center text-[10px] font-bold ${bar} cursor-pointer calm-transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]`}
                    style={{ width: `${pct}%` }}
                    title={`${d.band}: ${d.count} students (${Math.round(pct)}%) — click for list`}
                    onClick={() => openBand(d.band)}
                  >
                    {pct > 8 && `${d.from}%`}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {pctDistribution
                .filter((d) => d.count > 0)
                .map((d) => {
                  const pct = Math.round((d.count / pctDistTotal) * 100);
                  const { swatch } = pctBandDistributionStyle(d.from, d.to);
                  return (
                    <button
                      key={d.band}
                      type="button"
                      className="flex items-center gap-1.5 rounded-md calm-transition hover:text-[var(--on-surface)] cursor-pointer text-left"
                      onClick={() => openBand(d.band)}
                    >
                      <span className={`inline-block h-3 w-3 rounded-sm ${swatch}`} />
                      <span className="text-xs text-[var(--on-surface-muted)]">
                        {d.band}: <span className="font-semibold text-[var(--on-surface)]">{d.count}</span> ({pct}%)
                      </span>
                    </button>
                  );
                })}
            </div>

            <div className="flex flex-wrap gap-6 border-t border-[var(--outline-variant)]/20 pt-4">
              {pctThresholds.map(({ label, count, pct }) => (
                <div key={label} className="flex items-baseline gap-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--on-surface-muted)]">{label}</span>
                  <span className="text-2xl font-bold tabular-nums text-[var(--on-surface)]">{pct}%</span>
                  <span className="text-xs text-[var(--on-surface-muted)]">({count})</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!isPercentage && (
        <div className="space-y-3">
          <SectionHeader title="Grade Distribution" subtitle={`${distTotal > 0 ? distTotal : 0} students`} />
          <div className="rounded-2xl bg-[var(--surface-container-lowest)] p-6 shadow-ambient space-y-4">
            {distTotal > 0 ? (
              <>
                <div className="flex h-8 gap-0.5 overflow-hidden rounded-lg">
                  {distribution.map((d) => {
                    if (d.count === 0) return null;
                    const pct = (d.count / distTotal) * 100;
                    const { bar } = gradeDistributionBarStyle(d.grade, isGcse ? "GCSE" : "A_LEVEL");
                    return (
                      <button
                        key={d.grade}
                        type="button"
                        className={`flex items-center justify-center text-[11px] font-bold ${bar} cursor-pointer calm-transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]`}
                        style={{ width: `${pct}%` }}
                        title={`${d.grade}: ${d.count} (${Math.round(pct)}%) — click for list`}
                        onClick={() => openGrade(d.grade)}
                      >
                        {pct > 5 && d.grade}
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {distribution
                    .filter((d) => d.count > 0)
                    .map((d) => {
                      const pct = Math.round((d.count / distTotal) * 100);
                      const { swatch } = gradeDistributionBarStyle(d.grade, isGcse ? "GCSE" : "A_LEVEL");
                      return (
                        <button
                          key={d.grade}
                          type="button"
                          className="flex items-center gap-1.5 rounded-md calm-transition hover:text-[var(--on-surface)] cursor-pointer text-left"
                          onClick={() => openGrade(d.grade)}
                        >
                          <span className={`inline-block h-3 w-3 rounded-sm ${swatch}`} />
                          <span className="text-xs text-[var(--on-surface-muted)]">
                            Grade {d.grade}: <span className="font-semibold text-[var(--on-surface)]">{d.count}</span> ({pct}%)
                          </span>
                        </button>
                      );
                    })}
                </div>
                {isGcse && (
                  <div className="flex flex-wrap gap-3 pt-1 border-t border-[var(--outline-variant)]/20">
                    {[
                      { label: "4+", threshold: 4, cls: thresholdHeaderGcse.t4 },
                      { label: "5+", threshold: 5, cls: thresholdHeaderGcse.t5 },
                      { label: "7+", threshold: 7, cls: thresholdHeaderGcse.t7 },
                    ].map(({ label, threshold, cls }) => {
                      const count = distribution
                        .filter((e) => Number(e.grade) >= threshold)
                        .reduce((s, e) => s + e.count, 0);
                      const pct = distTotal > 0 ? Math.round((count / distTotal) * 100) : 0;
                      return (
                        <div key={label} className="flex items-baseline gap-1.5">
                          <span className={`text-xs font-bold uppercase tracking-wider ${cls}`}>{label}</span>
                          <span className={`text-xl font-bold tabular-nums ${cls}`}>{pct}%</span>
                          <span className="text-xs text-[var(--on-surface-muted)]">({count} students)</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-[var(--on-surface-muted)]">No grade data available.</p>
            )}
          </div>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-[var(--surface)] text-[var(--on-surface)] rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col border border-[var(--outline-variant)]/50">
            <div className="flex items-center justify-between p-4 border-b border-[var(--outline-variant)]/20">
              <h2 className="text-lg font-bold">
                {modal.kind === "grade"
                  ? `Students scoring ${modal.grade} in ${subjectName}`
                  : `Students in ${modal.band} in ${subjectName}`}
              </h2>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="text-[var(--on-surface-muted)] hover:text-[var(--on-surface)] p-2 rounded-lg hover:bg-[var(--surface-container)] transition-colors"
                aria-label="Close"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-3 overflow-y-auto flex-1">
              <div className="table-shell border-0 shadow-none">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 z-10 border-b border-[var(--outline-variant)]/20 anx-card-inset">
                    <tr className="table-head-row">
                      <th className="px-5 py-3">Student</th>
                      <th className="px-4 py-3 text-center">{scoreColumnLabel}</th>
                      <th className="px-4 py-3 text-center">Overall avg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...modal.students].sort((a, b) => a.name.localeCompare(b.name)).map((st) => (
                      <tr key={st.id} className="table-row calm-transition">
                        <td className="px-5 py-3 font-medium">
                          <Link href={`/students/${st.id}`} className="calm-transition hover:text-[var(--accent)]">
                            {st.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {st.isPercentage && st.rawValue ? (
                            <span
                              className={`inline-flex items-center rounded-md px-2.5 py-1 text-sm font-bold tabular-nums ${st.score !== null ? percentileCellClass(st.score) : "bg-[var(--surface-container)] text-[var(--on-surface)]"}`}
                            >
                              {st.rawValue}
                            </span>
                          ) : (
                            <span
                              className={`inline-flex h-8 min-w-[2rem] items-center justify-center rounded-lg px-2 text-sm font-bold ${st.isGcse ? gcseNumericCellClass(st.rawValue) : aLevelLetterCellClass(st.rawValue)}`}
                            >
                              {st.rawValue}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-[var(--on-surface-muted)] tabular-nums">{avgDisplay(st)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
