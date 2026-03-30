"use client";

/**
 * Key Measures Dashboard
 *
 * Provides GCSE and A-Level specific performance indicators:
 *
 * GCSE:
 *   - Basics: English & Maths combined 4+, 5+, 7+
 *   - PP gap and SEND gap
 *   - Subject-level threshold charts
 *   - Grade distribution per subject
 *
 * A-Level:
 *   - A-star/A/B/C+ rates across all entries
 *   - Subject-level grade distribution
 *   - Progress view (Mock 1 → Mock 2)
 */

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

type Cycle = {
  id: string;
  label: string;
  isActive: boolean;
  points: Array<{ id: string; label: string; ordinal: number }>;
};

type GradeFormat = "GCSE" | "A_LEVEL" | "PERCENTAGE" | "RAW";

type SubjectMeasure = {
  subject: string;
  gradeFormat: GradeFormat;
  pointLabel: string;
  total: number;
  presentCount: number;
  thresholds: Record<string, number>;
  ppThreshold4?: { pp: number; nonPp: number; gap: number };
  ppThreshold5?: { pp: number; nonPp: number; gap: number };
  distribution: Array<{ grade: string; count: number }>;
};

type GcseBasics = {
  em4pct: number;
  em5pct: number;
  em7pct: number;
  ppEm4: number;
  ppEm5: number;
  nonPpEm4: number;
  nonPpEm5: number;
  ppGap4: number;
  ppGap5: number;
  sendEm4: number;
  nonSendEm4: number;
  sendGap4: number;
};

type ALevelSummary = {
  aStarPct: number;
  aPct: number;
  bPct: number;
  cPlusPct: number;
  totalEntries: number;
  avgGradeValue: number | null;
};

type KeyMeasuresData = {
  dominantFormat: GradeFormat;
  totalStudents: number;
  totalResults: number;
  subjectMeasures: SubjectMeasure[];
  gcseBasics: GcseBasics | null;
  aLevelSummary: ALevelSummary | null;
  assessments: Array<{
    id: string;
    subject: string;
    yearGroup: string;
    gradeFormat: GradeFormat;
    pointLabel: string;
    pointOrdinal: number;
    resultCount: number;
  }>;
};

// ─── Grade colour helpers ─────────────────────────────────────────────────────

function gcseGradeColour(grade: string | number): string {
  const g = Number(grade);
  if (g >= 9) return "bg-emerald-700 text-white";
  if (g >= 8) return "bg-emerald-600 text-white";
  if (g >= 7) return "bg-green-500 text-white";
  if (g >= 6) return "bg-blue-500 text-white";
  if (g >= 5) return "bg-violet-500 text-white";
  if (g >= 4) return "bg-amber-500 text-white";
  if (g >= 3) return "bg-orange-500 text-white";
  if (g >= 2) return "bg-red-500 text-white";
  return "bg-red-700 text-white";
}

function aLevelGradeColour(grade: string): string {
  switch (grade.toUpperCase()) {
    case "A*": return "bg-emerald-600 text-white";
    case "A":  return "bg-green-500 text-white";
    case "B":  return "bg-blue-500 text-white";
    case "C":  return "bg-violet-500 text-white";
    case "D":  return "bg-amber-500 text-white";
    case "E":  return "bg-orange-500 text-white";
    default:   return "bg-red-700 text-white";
  }
}

function gapColour(gap: number): string {
  if (gap <= 5) return "text-[var(--success)]";
  if (gap <= 15) return "text-[var(--warning)]";
  return "text-[var(--error)]";
}

function pctBar(pct: number, colour: string) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-container)]">
        <div
          className={`absolute inset-y-0 left-0 rounded-full ${colour}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <span className="w-9 text-right text-sm font-bold tabular-nums">{pct}%</span>
    </div>
  );
}

// ─── Grade distribution mini bar chart ───────────────────────────────────────

function GradeDistBar({
  distribution,
  format,
}: {
  distribution: Array<{ grade: string; count: number }>;
  format: GradeFormat;
}) {
  const total = distribution.reduce((s, d) => s + d.count, 0);
  if (total === 0) return <p className="text-xs text-[var(--on-surface-muted)]">No data</p>;

  return (
    <div className="space-y-1">
      <div className="flex h-6 gap-0.5 overflow-hidden rounded">
        {distribution.map((d) => {
          if (d.count === 0) return null;
          const pct = (d.count / total) * 100;
          const cls = format === "GCSE" ? gcseGradeColour(d.grade) : aLevelGradeColour(d.grade);
          return (
            <div
              key={d.grade}
              className={`flex items-center justify-center text-[10px] font-bold ${cls}`}
              style={{ width: `${pct}%`, minWidth: pct > 4 ? undefined : "0" }}
              title={`${d.grade}: ${d.count} (${Math.round(pct)}%)`}
            >
              {pct > 6 && d.grade}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {distribution.map((d) => {
          const pct = total > 0 ? Math.round((d.count / total) * 100) : 0;
          const cls = format === "GCSE" ? gcseGradeColour(d.grade) : aLevelGradeColour(d.grade);
          return (
            <span key={d.grade} className="flex items-center gap-1 text-[10px] text-[var(--on-surface-muted)]">
              <span className={`inline-block h-2 w-2 rounded-sm ${cls}`} />
              {d.grade}: {d.count} ({pct}%)
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function KeyMeasuresPage() {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState("");
  const [selectedPointId, setSelectedPointId] = useState("");
  const [data, setData] = useState<KeyMeasuresData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/assessments/cycles")
      .then((r) => r.json())
      .then(({ cycles: c }) => {
        setCycles(c ?? []);
        const active = c?.find((x: Cycle) => x.isActive) ?? c?.[0];
        if (active) {
          setSelectedCycleId(active.id);
          // Default to most recent point
          const latestPoint = active.points?.[active.points.length - 1];
          if (latestPoint) setSelectedPointId(latestPoint.id);
        }
      })
      .catch(() => {});
  }, []);

  const selectedCycle = cycles.find((c) => c.id === selectedCycleId);

  const loadMeasures = useCallback(async () => {
    if (!selectedPointId && !selectedCycleId) return;
    setLoading(true);
    setError(null);
    try {
      const params = selectedPointId
        ? `pointId=${selectedPointId}`
        : `cycleId=${selectedCycleId}`;
      const res = await fetch(`/api/assessments/key-measures?${params}`);
      if (!res.ok) throw new Error("Failed to load key measures");
      const d = await res.json();
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [selectedPointId, selectedCycleId]);

  useEffect(() => {
    loadMeasures();
  }, [loadMeasures]);

  const isGcse = data?.dominantFormat === "GCSE";
  const isALevel = data?.dominantFormat === "A_LEVEL";

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Key Measures"
          subtitle="GCSE and A-Level performance indicators, threshold analysis, and gap data."
        />
        <Link href="/assessments" className="text-sm text-[var(--on-surface-muted)] hover:underline">
          ← Assessments
        </Link>
      </div>

      {/* Cycle selector */}
      {cycles.length > 0 && (
        <Card className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs font-medium uppercase tracking-wide text-[var(--on-surface-muted)]">
                Assessment cycle
              </label>
              <select
                className="field w-full"
                value={selectedCycleId}
                onChange={(e) => {
                  setSelectedCycleId(e.target.value);
                  const c = cycles.find((x) => x.id === e.target.value);
                  const latest = c?.points?.[c.points.length - 1];
                  setSelectedPointId(latest?.id ?? "");
                }}
              >
                {cycles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                    {c.isActive ? " (Active)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {selectedCycle && selectedCycle.points.length > 0 && (
              <div className="space-y-1">
                <label className="text-xs font-medium uppercase tracking-wide text-[var(--on-surface-muted)]">
                  Assessment point
                </label>
                <select
                  className="field w-full"
                  value={selectedPointId}
                  onChange={(e) => setSelectedPointId(e.target.value)}
                >
                  <option value="">All points</option>
                  {selectedCycle.points.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </Card>
      )}

      {cycles.length === 0 && (
        <Card className="py-12 text-center">
          <p className="text-[var(--on-surface-muted)]">No assessment cycles found.</p>
          <p className="mt-1 text-sm text-[var(--on-surface-muted)]">
            <Link href="/assessments/setup" className="text-[var(--accent)] underline underline-offset-2">
              Create a cycle
            </Link>{" "}
            and upload results to see key measures.
          </p>
        </Card>
      )}

      {loading && (
        <Card className="py-8 text-center">
          <p className="text-sm text-[var(--on-surface-muted)]">Loading measures…</p>
        </Card>
      )}

      {error && (
        <Card className="py-6 text-center">
          <p className="text-sm text-[var(--error)]">{error}</p>
        </Card>
      )}

      {!loading && data && data.totalResults === 0 && (
        <Card className="py-12 text-center">
          <p className="text-[var(--on-surface-muted)]">No results uploaded for this selection.</p>
          <p className="mt-1 text-sm text-[var(--on-surface-muted)]">
            Upload CSV results for an assessment point to see key measures.
          </p>
        </Card>
      )}

      {!loading && data && data.totalResults > 0 && (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--on-surface-muted)]">
                Students assessed
              </p>
              <p className="text-2xl font-bold tabular-nums text-[var(--on-surface)]">
                {data.totalStudents}
              </p>
            </Card>
            <Card className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--on-surface-muted)]">
                Grade entries
              </p>
              <p className="text-2xl font-bold tabular-nums text-[var(--on-surface)]">
                {data.totalResults.toLocaleString()}
              </p>
            </Card>
            <Card className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--on-surface-muted)]">
                Subjects
              </p>
              <p className="text-2xl font-bold tabular-nums text-[var(--on-surface)]">
                {data.subjectMeasures.length}
              </p>
            </Card>
          </div>

          {/* ─── GCSE BASICS ──────────────────────────────────────────────── */}
          {isGcse && data.gcseBasics && (
            <Card className="space-y-5">
              <SectionHeader
                title="English & Maths — Basics"
                subtitle="Combined threshold performance for English and Maths (both subjects must meet threshold)"
              />

              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Both E&M 4+", val: data.gcseBasics.em4pct, colour: "bg-amber-500" },
                  { label: "Both E&M 5+", val: data.gcseBasics.em5pct, colour: "bg-violet-500" },
                  { label: "Both E&M 7+", val: data.gcseBasics.em7pct, colour: "bg-green-500" },
                ].map(({ label, val, colour }) => (
                  <div key={label} className="rounded-xl bg-[var(--surface-container-low)] p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-[var(--on-surface-muted)]">
                      {label}
                    </p>
                    <p className="mt-1 text-3xl font-bold tabular-nums text-[var(--on-surface)]">
                      {val}%
                    </p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-container)]">
                      <div className={`h-full rounded-full ${colour}`} style={{ width: `${val}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* PP Gap */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-[var(--on-surface)]">
                  Pupil Premium Gap — E&M Combined
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    {
                      label: "4+ threshold",
                      pp: data.gcseBasics.ppEm4,
                      nonPp: data.gcseBasics.nonPpEm4,
                      gap: data.gcseBasics.ppGap4,
                    },
                    {
                      label: "5+ threshold",
                      pp: data.gcseBasics.ppEm5,
                      nonPp: data.gcseBasics.nonPpEm5,
                      gap: data.gcseBasics.ppGap5,
                    },
                  ].map(({ label, pp, nonPp, gap }) => (
                    <div key={label} className="rounded-xl bg-[var(--surface-container-low)] p-4 space-y-2">
                      <p className="text-xs font-medium text-[var(--on-surface-muted)]">{label}</p>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[var(--on-surface-muted)]">Non-PP</span>
                          <span className="font-bold tabular-nums text-[var(--on-surface)]">{nonPp}%</span>
                        </div>
                        {pctBar(nonPp, "bg-[var(--accent)]")}
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[var(--on-surface-muted)]">PP</span>
                          <span className="font-bold tabular-nums text-[var(--on-surface)]">{pp}%</span>
                        </div>
                        {pctBar(pp, "bg-violet-400")}
                        <div className={`flex justify-between text-xs font-bold ${gapColour(gap)}`}>
                          <span>Gap</span>
                          <span>{gap > 0 ? "+" : ""}{gap}pp</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* SEND Gap */}
              {data.gcseBasics.sendEm4 > 0 || data.gcseBasics.nonSendEm4 > 0 ? (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-[var(--on-surface)]">
                    SEND Gap — E&M 4+ Combined
                  </h4>
                  <div className="rounded-xl bg-[var(--surface-container-low)] p-4 space-y-2 max-w-sm">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[var(--on-surface-muted)]">Non-SEND</span>
                      <span className="font-bold tabular-nums">{data.gcseBasics.nonSendEm4}%</span>
                    </div>
                    {pctBar(data.gcseBasics.nonSendEm4, "bg-[var(--accent)]")}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[var(--on-surface-muted)]">SEND</span>
                      <span className="font-bold tabular-nums">{data.gcseBasics.sendEm4}%</span>
                    </div>
                    {pctBar(data.gcseBasics.sendEm4, "bg-amber-400")}
                    <div className={`flex justify-between text-xs font-bold ${gapColour(data.gcseBasics.sendGap4)}`}>
                      <span>Gap</span>
                      <span>{data.gcseBasics.sendGap4 > 0 ? "+" : ""}{data.gcseBasics.sendGap4}pp</span>
                    </div>
                  </div>
                </div>
              ) : null}
            </Card>
          )}

          {/* ─── A-LEVEL SUMMARY ─────────────────────────────────────────── */}
          {isALevel && data.aLevelSummary && (
            <Card className="space-y-5">
              <SectionHeader
                title="A-Level — Overall Grade Profile"
                subtitle={`Across all ${data.aLevelSummary.totalEntries} entries`}
              />

              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: "A* rate", val: data.aLevelSummary.aStarPct, colour: "bg-emerald-600" },
                  { label: "A or above", val: data.aLevelSummary.aPct, colour: "bg-green-500" },
                  { label: "B or above", val: data.aLevelSummary.bPct, colour: "bg-blue-500" },
                  { label: "C+ (pass)", val: data.aLevelSummary.cPlusPct, colour: "bg-violet-500" },
                ].map(({ label, val, colour }) => (
                  <div key={label} className="rounded-xl bg-[var(--surface-container-low)] p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-[var(--on-surface-muted)]">
                      {label}
                    </p>
                    <p className="mt-1 text-3xl font-bold tabular-nums text-[var(--on-surface)]">
                      {val}%
                    </p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-container)]">
                      <div className={`h-full rounded-full ${colour}`} style={{ width: `${val}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* ─── PER-SUBJECT MEASURES ────────────────────────────────────── */}
          <Card className="space-y-4">
            <SectionHeader
              title="Subject Breakdown"
              subtitle={`${data.subjectMeasures.length} subject${data.subjectMeasures.length !== 1 ? "s" : ""}`}
            />

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--outline-variant)]/30 text-left text-xs font-medium uppercase tracking-wide text-[var(--on-surface-muted)]">
                    <th className="pb-2 pr-4">Subject</th>
                    <th className="pb-2 pr-3 text-right">N</th>
                    {isGcse && (
                      <>
                        <th className="pb-2 pr-3 text-right">4+</th>
                        <th className="pb-2 pr-3 text-right">5+</th>
                        <th className="pb-2 pr-3 text-right">7+</th>
                      </>
                    )}
                    {isALevel && (
                      <>
                        <th className="pb-2 pr-3 text-right">A*</th>
                        <th className="pb-2 pr-3 text-right">A+</th>
                        <th className="pb-2 pr-3 text-right">B+</th>
                        <th className="pb-2 pr-3 text-right">C+</th>
                      </>
                    )}
                    <th className="pb-2">Distribution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--outline-variant)]/20">
                  {data.subjectMeasures
                    .sort((a, b) => a.subject.localeCompare(b.subject))
                    .map((sm) => (
                      <tr key={sm.subject} className="group">
                        <td className="py-3 pr-4 font-medium text-[var(--on-surface)]">
                          {sm.subject}
                          <span className="ml-1.5 text-xs font-normal text-[var(--on-surface-muted)]">
                            {sm.pointLabel}
                          </span>
                        </td>
                        <td className="py-3 pr-3 text-right tabular-nums text-[var(--on-surface-muted)]">
                          {sm.presentCount}
                        </td>
                        {isGcse && (
                          <>
                            <td className="py-3 pr-3 text-right font-semibold tabular-nums text-amber-600">
                              {sm.thresholds["4+"] ?? "—"}%
                            </td>
                            <td className="py-3 pr-3 text-right font-semibold tabular-nums text-violet-600">
                              {sm.thresholds["5+"] ?? "—"}%
                            </td>
                            <td className="py-3 pr-3 text-right font-semibold tabular-nums text-green-600">
                              {sm.thresholds["7+"] ?? "—"}%
                            </td>
                          </>
                        )}
                        {isALevel && (
                          <>
                            <td className="py-3 pr-3 text-right font-semibold tabular-nums text-emerald-600">
                              {sm.thresholds["A*+"] ?? "—"}%
                            </td>
                            <td className="py-3 pr-3 text-right font-semibold tabular-nums text-green-600">
                              {sm.thresholds["A+"] ?? "—"}%
                            </td>
                            <td className="py-3 pr-3 text-right font-semibold tabular-nums text-blue-600">
                              {sm.thresholds["B+"] ?? "—"}%
                            </td>
                            <td className="py-3 pr-3 text-right font-semibold tabular-nums text-violet-600">
                              {sm.thresholds["C+"] ?? "—"}%
                            </td>
                          </>
                        )}
                        <td className="py-3 min-w-[180px]">
                          <GradeDistBar
                            distribution={sm.distribution}
                            format={sm.gradeFormat}
                          />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* ─── PP GAP TABLE (GCSE subject-level) ────────────────────────── */}
          {isGcse && data.subjectMeasures.some((sm) => sm.ppThreshold4) && (
            <Card className="space-y-4">
              <SectionHeader
                title="Pupil Premium Gap by Subject"
                subtitle="4+ threshold — percentage point gap between Non-PP and PP students"
              />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--outline-variant)]/30 text-left text-xs font-medium uppercase tracking-wide text-[var(--on-surface-muted)]">
                      <th className="pb-2 pr-4">Subject</th>
                      <th className="pb-2 pr-3 text-right">Non-PP 4+</th>
                      <th className="pb-2 pr-3 text-right">PP 4+</th>
                      <th className="pb-2 pr-3 text-right">Gap</th>
                      <th className="pb-2 pr-3 text-right">Non-PP 5+</th>
                      <th className="pb-2 pr-3 text-right">PP 5+</th>
                      <th className="pb-2 text-right">Gap</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--outline-variant)]/20">
                    {data.subjectMeasures
                      .filter((sm) => sm.ppThreshold4)
                      .sort((a, b) => (b.ppThreshold4?.gap ?? 0) - (a.ppThreshold4?.gap ?? 0))
                      .map((sm) => (
                        <tr key={sm.subject}>
                          <td className="py-2.5 pr-4 font-medium text-[var(--on-surface)]">
                            {sm.subject}
                          </td>
                          <td className="py-2.5 pr-3 text-right tabular-nums text-[var(--accent)]">
                            {sm.ppThreshold4!.nonPp}%
                          </td>
                          <td className="py-2.5 pr-3 text-right tabular-nums text-violet-500">
                            {sm.ppThreshold4!.pp}%
                          </td>
                          <td className={`py-2.5 pr-3 text-right font-bold tabular-nums ${gapColour(sm.ppThreshold4!.gap)}`}>
                            {sm.ppThreshold4!.gap > 0 ? "+" : ""}{sm.ppThreshold4!.gap}pp
                          </td>
                          <td className="py-2.5 pr-3 text-right tabular-nums text-[var(--accent)]">
                            {sm.ppThreshold5?.nonPp ?? "—"}
                            {sm.ppThreshold5 ? "%" : ""}
                          </td>
                          <td className="py-2.5 pr-3 text-right tabular-nums text-violet-500">
                            {sm.ppThreshold5?.pp ?? "—"}
                            {sm.ppThreshold5 ? "%" : ""}
                          </td>
                          <td className={`py-2.5 text-right font-bold tabular-nums ${sm.ppThreshold5 ? gapColour(sm.ppThreshold5.gap) : ""}`}>
                            {sm.ppThreshold5
                              ? `${sm.ppThreshold5.gap > 0 ? "+" : ""}${sm.ppThreshold5.gap}pp`
                              : "—"}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Quick links */}
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/assessments/dashboard`}
              className="rounded-xl border border-[var(--outline-variant)] px-4 py-2 text-sm text-[var(--on-surface)] hover:bg-[var(--surface-container-low)]"
            >
              Full dashboard →
            </Link>
            <Link
              href={`/assessments/compare`}
              className="rounded-xl border border-[var(--outline-variant)] px-4 py-2 text-sm text-[var(--on-surface)] hover:bg-[var(--surface-container-low)]"
            >
              Compare datasets →
            </Link>
            <Link
              href={`/assessments/metrics`}
              className="rounded-xl border border-[var(--outline-variant)] px-4 py-2 text-sm text-[var(--on-surface)] hover:bg-[var(--surface-container-low)]"
            >
              Metric builder →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
