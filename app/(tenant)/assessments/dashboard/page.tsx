/**
 * Assessment Dashboard
 *
 * Shows a comprehensive overview of assessment data across cycles:
 *   - Summary stats (assessments uploaded, results recorded, subjects covered)
 *   - Per-cycle subject × year-group heatmap of mean normalised scores
 *   - Grade distribution bars per assessment
 *
 * Query params: ?cycleId=
 */

import { getSessionUserOrThrow } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { PageHeader } from "@/components/ui/page-header";
import { displayGrade } from "@/modules/assessments/gradeNormalizer";
import Link from "next/link";
import type { GradeFormat } from "@prisma/client";

type SearchParams = { cycleId?: string };

const BUCKET_COLOURS = [
  "bg-[var(--success)]",
  "bg-[var(--accent)]/60",
  "bg-[var(--warning)]/60",
  "bg-[var(--error)]/60",
];

function scoreToPercent(n: number | null) {
  if (n === null) return null;
  return Math.round(n * 100);
}

function heatColour(normalized: number | null): string {
  if (normalized === null) return "bg-[var(--surface-container)] text-[var(--on-surface-muted)]";
  if (normalized >= 0.75) return "bg-[var(--success)]/20 text-[var(--success)]";
  if (normalized >= 0.5) return "bg-[var(--accent)]/15 text-[var(--accent)]";
  if (normalized >= 0.25) return "bg-[var(--warning)]/20 text-[var(--warning)]";
  return "bg-[var(--error)]/15 text-[var(--error)]";
}

export default async function AssessmentDashboardPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const user = await getSessionUserOrThrow();

  // Load all cycles for selector
  const cycles = await prisma.assessmentCycle.findMany({
    where: { tenantId: user.tenantId },
    orderBy: [{ isActive: "desc" }, { startDate: "desc" }],
    select: { id: true, label: true, isActive: true },
  });

  const selectedCycleId = searchParams?.cycleId ?? cycles[0]?.id ?? null;
  const selectedCycle = cycles.find((c) => c.id === selectedCycleId) ?? null;

  if (!selectedCycle) {
    return (
      <div className="max-w-5xl space-y-6">
        <PageHeader
          title="Assessment Dashboard"
          subtitle="Visual overview of attainment across cycles and subjects."
        />
        <Card className="py-12 text-center">
          <p className="text-[var(--on-surface-muted)]">No assessment cycles found.</p>
          <p className="mt-1 text-sm text-[var(--on-surface-muted)]">
            <Link href="/assessments/setup" className="text-[var(--accent)] underline underline-offset-2">
              Create a cycle
            </Link>{" "}
            to get started.
          </p>
        </Card>
      </div>
    );
  }

  // Load full cycle data with points, assessments and results
  const cycleData = await prisma.assessmentCycle.findFirst({
    where: { id: selectedCycle.id, tenantId: user.tenantId },
    include: {
      points: {
        orderBy: { ordinal: "asc" },
        include: {
          assessments: {
            include: {
              results: {
                where: { tenantId: user.tenantId, status: "PRESENT" },
                select: { normalizedScore: true, status: true },
              },
              _count: { select: { results: true } },
            },
          },
        },
      },
    },
  });

  if (!cycleData) {
    return null;
  }

  // Flatten all assessments in cycle
  const allAssessments = cycleData.points.flatMap((p) =>
    p.assessments.map((a) => ({ ...a, pointLabel: p.label, pointOrdinal: p.ordinal }))
  );

  const totalResults = allAssessments.reduce((sum, a) => sum + a._count.results, 0);
  const totalStudents = new Set(
    allAssessments.flatMap((a) => a.results.map((r) => r.normalizedScore))
  ).size;

  // Build subject × yearGroup heatmap of mean scores
  type HeatCell = { mean: number | null; count: number; assessmentId: string };
  const subjectYgMap = new Map<string, Map<string, HeatCell>>();

  for (const a of allAssessments) {
    const scores = a.results
      .map((r) => r.normalizedScore)
      .filter((s): s is number => s !== null);
    const mean = scores.length > 0 ? scores.reduce((acc, s) => acc + s, 0) / scores.length : null;

    if (!subjectYgMap.has(a.subject)) subjectYgMap.set(a.subject, new Map());
    const inner = subjectYgMap.get(a.subject)!;

    // Use the latest point's data if there are multiple assessments per subject+yg
    const existing = inner.get(a.yearGroup);
    if (!existing || a.pointOrdinal > (allAssessments.find((x) => x.id === existing.assessmentId)?.pointOrdinal ?? 0)) {
      inner.set(a.yearGroup, { mean, count: a._count.results, assessmentId: a.id });
    }
  }

  const subjects = [...subjectYgMap.keys()].sort();
  const yearGroups = [
    ...new Set(allAssessments.map((a) => a.yearGroup)),
  ].sort();

  // Per-point summary stats
  const pointSummaries = cycleData.points.map((p) => {
    const pointResults = p.assessments.flatMap((a) => a.results);
    const scores = pointResults
      .map((r) => r.normalizedScore)
      .filter((s): s is number => s !== null);
    const mean = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    return {
      id: p.id,
      label: p.label,
      assessmentCount: p.assessments.length,
      resultCount: pointResults.length,
      meanNormalized: mean,
    };
  });

  // Distribution buckets across entire cycle
  const allScores = allAssessments
    .flatMap((a) => a.results.map((r) => r.normalizedScore))
    .filter((s): s is number => s !== null);

  const buckets = [
    { label: "High (75%+)", count: allScores.filter((s) => s >= 0.75).length },
    { label: "Mid-high (50–74%)", count: allScores.filter((s) => s >= 0.5 && s < 0.75).length },
    { label: "Mid-low (25–49%)", count: allScores.filter((s) => s >= 0.25 && s < 0.5).length },
    { label: "Low (<25%)", count: allScores.filter((s) => s < 0.25).length },
  ];

  return (
    <div className="max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <PageHeader
          title="Assessment Dashboard"
          subtitle={`Attainment overview · ${selectedCycle.label}`}
        />
        <Link href="/assessments" className="text-sm text-[var(--on-surface-muted)] hover:underline">
          ← Assessments
        </Link>
      </div>

      {/* Cycle selector */}
      {cycles.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {cycles.map((c) => (
            <Link
              key={c.id}
              href={`/assessments/dashboard?cycleId=${c.id}`}
              className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                c.id === selectedCycle.id
                  ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                  : "border-[var(--outline-variant)] text-[var(--on-surface-muted)] hover:border-[var(--accent)]/40"
              }`}
            >
              {c.label}
              {c.isActive && (
                <span className="ml-1.5 rounded-full bg-[var(--success)]/15 px-1.5 py-0.5 text-[10px] font-medium text-[var(--success)]">
                  Active
                </span>
              )}
            </Link>
          ))}
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--on-surface-muted)]">
            Assessment points
          </p>
          <p className="text-2xl font-bold text-[var(--on-surface)]">{cycleData.points.length}</p>
        </Card>
        <Card className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--on-surface-muted)]">
            Assessments uploaded
          </p>
          <p className="text-2xl font-bold text-[var(--on-surface)]">{allAssessments.length}</p>
        </Card>
        <Card className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--on-surface-muted)]">
            Results recorded
          </p>
          <p className="text-2xl font-bold text-[var(--on-surface)]">{totalResults.toLocaleString()}</p>
        </Card>
        <Card className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--on-surface-muted)]">
            Subjects covered
          </p>
          <p className="text-2xl font-bold text-[var(--on-surface)]">{subjects.length}</p>
        </Card>
      </div>

      {/* Grade distribution across cycle */}
      {allScores.length > 0 && (
        <Card className="space-y-3">
          <SectionHeader title="Overall grade distribution" subtitle={`${allScores.length} graded results across all assessments in ${selectedCycle.label}`} />
          <div className="flex h-10 gap-0.5 overflow-hidden rounded-xl">
            {buckets.map((b, i) => {
              const pct = allScores.length > 0 ? (b.count / allScores.length) * 100 : 0;
              if (pct === 0) return null;
              return (
                <div
                  key={b.label}
                  title={`${b.label}: ${b.count} results (${Math.round(pct)}%)`}
                  className={`${BUCKET_COLOURS[i]} flex items-center justify-center text-xs font-medium text-white`}
                  style={{ width: `${pct}%` }}
                >
                  {pct > 6 && `${Math.round(pct)}%`}
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-[var(--on-surface-muted)]">
            {buckets.map((b, i) => (
              <span key={b.label} className="flex items-center gap-1.5">
                <span className={`inline-block h-2.5 w-2.5 rounded-sm ${BUCKET_COLOURS[i]}`} />
                {b.label}: {b.count}
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Assessment point progress */}
      {pointSummaries.length > 0 && (
        <Card className="space-y-4">
          <SectionHeader title="Assessment points" subtitle="Mean attainment across all subjects per point" />
          <div className="space-y-3">
            {pointSummaries.map((p) => {
              const pct = p.meanNormalized !== null ? Math.round(p.meanNormalized * 100) : null;
              return (
                <div key={p.id} className="flex items-center gap-4">
                  <div className="w-28 shrink-0">
                    <p className="text-sm font-medium text-[var(--on-surface)]">{p.label}</p>
                    <p className="text-xs text-[var(--on-surface-muted)]">
                      {p.assessmentCount} assessment{p.assessmentCount !== 1 ? "s" : ""}
                      {" · "}
                      {p.resultCount} results
                    </p>
                  </div>
                  <div className="flex-1">
                    {pct !== null ? (
                      <div className="flex items-center gap-3">
                        <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-container)]">
                          <div
                            className="absolute inset-y-0 left-0 rounded-full bg-[var(--accent)]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-10 text-right text-sm font-semibold tabular-nums text-[var(--accent)]">
                          {pct}%
                        </span>
                      </div>
                    ) : (
                      <p className="text-sm text-[var(--on-surface-muted)]">No results yet</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Subject × Year Group heatmap */}
      {subjects.length > 0 && yearGroups.length > 0 && (
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <SectionHeader
              title="Attainment heatmap"
              subtitle="Mean normalised score per subject × year group (latest assessment point)"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium uppercase tracking-wide text-[var(--on-surface-muted)]">
                  <th className="pb-3 pr-4">Subject</th>
                  {yearGroups.map((yg) => (
                    <th key={yg} className="pb-3 pr-2 text-center">
                      {yg}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--outline-variant)]/30">
                {subjects.map((subject) => {
                  const row = subjectYgMap.get(subject)!;
                  return (
                    <tr key={subject}>
                      <td className="py-2 pr-4 font-medium text-[var(--on-surface)]">{subject}</td>
                      {yearGroups.map((yg) => {
                        const cell = row.get(yg);
                        const pct = scoreToPercent(cell?.mean ?? null);
                        return (
                          <td key={yg} className="py-2 pr-2 text-center">
                            {cell ? (
                              <Link
                                href={`/assessments/results/${cell.assessmentId}`}
                                className={`inline-flex items-center justify-center rounded-lg px-2 py-1 text-xs font-semibold tabular-nums transition-opacity hover:opacity-80 ${heatColour(cell.mean)}`}
                                title={`${subject} · ${yg}: ${cell.count} results`}
                              >
                                {pct !== null ? `${pct}%` : "—"}
                              </Link>
                            ) : (
                              <span className="text-[var(--on-surface-muted)]">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-[var(--on-surface-muted)]">
            Cells show mean attainment as a percentage of the maximum possible score. Click a cell to view that assessment&apos;s full results.
          </p>
        </Card>
      )}

      {/* Per-assessment breakdown */}
      {allAssessments.length > 0 && (
        <Card className="space-y-4">
          <SectionHeader title="All assessments" subtitle="Click an assessment to view full results or compare datasets" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--outline-variant)]/30 text-left text-xs font-medium uppercase tracking-wide text-[var(--on-surface-muted)]">
                  <th className="pb-2 pr-4">Assessment</th>
                  <th className="pb-2 pr-4">Point</th>
                  <th className="pb-2 pr-4">Year</th>
                  <th className="pb-2 pr-4">Format</th>
                  <th className="pb-2 pr-4 text-right">Results</th>
                  <th className="pb-2 text-right">Mean</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--outline-variant)]/20">
                {allAssessments
                  .sort((a, b) => a.pointOrdinal - b.pointOrdinal || a.subject.localeCompare(b.subject))
                  .map((a) => {
                    const scores = a.results
                      .map((r) => r.normalizedScore)
                      .filter((s): s is number => s !== null);
                    const mean =
                      scores.length > 0
                        ? scores.reduce((acc, s) => acc + s, 0) / scores.length
                        : null;
                    return (
                      <tr key={a.id} className="group">
                        <td className="py-2.5 pr-4">
                          <Link
                            href={`/assessments/${a.id}/results`}
                            className="font-medium text-[var(--on-surface)] hover:text-[var(--accent)]"
                          >
                            {a.title}
                          </Link>
                        </td>
                        <td className="py-2.5 pr-4 text-[var(--on-surface-muted)]">{a.pointLabel}</td>
                        <td className="py-2.5 pr-4 text-[var(--on-surface-muted)]">{a.yearGroup}</td>
                        <td className="py-2.5 pr-4 text-[var(--on-surface-muted)]">{a.gradeFormat}</td>
                        <td className="py-2.5 pr-4 text-right tabular-nums text-[var(--on-surface-muted)]">
                          {a._count.results}
                        </td>
                        <td className="py-2.5 text-right font-semibold tabular-nums text-[var(--accent)]">
                          {mean !== null
                            ? displayGrade(mean, a.gradeFormat as GradeFormat, a.maxScore)
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {allAssessments.length === 0 && (
        <Card className="py-12 text-center">
          <p className="text-[var(--on-surface-muted)]">No assessments uploaded for this cycle yet.</p>
          <p className="mt-1 text-sm text-[var(--on-surface-muted)]">
            Go to an assessment point and upload results, or{" "}
            <Link href="/assessments/adhoc" className="text-[var(--accent)] underline underline-offset-2">
              enter data manually
            </Link>
            .
          </p>
        </Card>
      )}

      {/* Quick links */}
      <div className="flex gap-3">
        <Link
          href={`/assessments/compare`}
          className="rounded-xl border border-[var(--outline-variant)] px-4 py-2 text-sm text-[var(--on-surface)] hover:bg-[var(--surface-container-low)]"
        >
          Compare datasets →
        </Link>
        <Link
          href={`/assessments/progress?cycleId=${selectedCycle.id}`}
          className="rounded-xl border border-[var(--outline-variant)] px-4 py-2 text-sm text-[var(--on-surface)] hover:bg-[var(--surface-container-low)]"
        >
          Progress tracker →
        </Link>
        <Link
          href="/assessments/adhoc"
          className="rounded-xl border border-[var(--outline-variant)] px-4 py-2 text-sm text-[var(--on-surface)] hover:bg-[var(--surface-container-low)]"
        >
          Add ad-hoc data →
        </Link>
      </div>
    </div>
  );
}
