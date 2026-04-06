/**
 * Subject Detail Page
 *
 * Drill-down for a single subject within a result point.
 * Adapts to three grade formats:
 *   GCSE      — grade distribution, 4+/5+/7+ thresholds, PP/SEND gap
 *   A_LEVEL   — grade distribution, A+/B+/C+ thresholds
 *   PERCENTAGE/RAW — percentile distribution, class comparison, rank order
 *
 * All formats show:
 *   - Per-student score, overall mean across subjects, diff vs mean, rank
 *   - Filter/search by name, PP, SEND
 */

import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeader } from "@/components/ui/section-header";
import { SubjectStudentsFilterBar } from "./SubjectStudentsFilterBar";
import type { GradeFormat } from "@prisma/client";
import { hasRecordedGrade } from "@/modules/assessments/gradeNormalizer";
import { competitionRank } from "@/modules/assessments/ranking";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const A_LEVEL_SCORE: Record<string, number> = {
  "A*": 7, A: 6, B: 5, C: 4, D: 3, E: 2, U: 1,
};
const A_LEVEL_ORDER = ["A*", "A", "B", "C", "D", "E", "U"] as const;

function getInitials(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length >= 2)
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

function gcseColour(g: string | number | null): string {
  if (g === null) return "bg-surface-container-low text-muted";
  const n = Number(g);
  if (n >= 8) return "bg-emerald-600 text-white";
  if (n >= 7) return "bg-green-500 text-white";
  if (n >= 6) return "bg-blue-500 text-white";
  if (n >= 5) return "bg-violet-500 text-white";
  if (n >= 4) return "bg-amber-500 text-white";
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

function pctColour(score: number): string {
  if (score >= 80) return "bg-emerald-600 text-white";
  if (score >= 70) return "bg-green-500 text-white";
  if (score >= 60) return "bg-blue-500 text-white";
  if (score >= 50) return "bg-violet-500 text-white";
  if (score >= 40) return "bg-amber-500 text-white";
  if (score >= 30) return "bg-orange-500 text-white";
  return "bg-red-600 text-white";
}

function gcseThresholdPct(
  results: Array<{ normalizedScore: number | null; status: string }>,
  threshold: number
): number {
  const present = results.filter(r => r.status === "PRESENT");
  if (present.length === 0) return 0;
  const above = present.filter(r => r.normalizedScore !== null && Math.round(r.normalizedScore * 9) >= threshold);
  return Math.round((above.length / present.length) * 100);
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function GapBadge({ gap }: { gap: number }) {
  const cls = gap <= 5
    ? "bg-emerald-50 text-emerald-700"
    : gap <= 15
      ? "bg-amber-50 text-amber-700"
      : "bg-red-50 text-red-700";
  return (
    <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[12px] font-bold tabular-nums ${cls}`}>
      {gap > 0 ? "+" : ""}{gap}pp gap
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default async function SubjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ cycleId: string; pointId: string; subject: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { cycleId, pointId, subject: encodedSubject } = await params;
  const subjectName = decodeURIComponent(encodedSubject);

  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ASSESSMENTS");

  const currentPoint = await prisma.assessmentPoint.findUnique({
    where: { id: pointId, tenantId: user.tenantId },
    include: { cycle: true },
  });
  if (!currentPoint) notFound();

  // Fetch this subject's assessment
  const assessment = await prisma.assessment.findFirst({
    where: { pointId, tenantId: user.tenantId, subject: subjectName },
    include: {
      results: {
        where: { tenantId: user.tenantId },
        include: {
          student: {
            select: { id: true, fullName: true, yearGroup: true, ppFlag: true, sendFlag: true },
          },
        },
      },
    },
  });
  if (!assessment) notFound();

  const isGcse = assessment.gradeFormat === "GCSE";
  const isPercentage = assessment.gradeFormat === "PERCENTAGE" || assessment.gradeFormat === "RAW";

  // Fetch all assessments in this point to compute per-student averages
  const allAssessments = await prisma.assessment.findMany({
    where: {
      pointId,
      tenantId: user.tenantId,
      gradeFormat: assessment.gradeFormat,
    },
    include: {
      results: {
        where: { tenantId: user.tenantId, status: "PRESENT" },
        select: { studentId: true, normalizedScore: true, rawValue: true },
      },
    },
  });

  // For PERCENTAGE: fetch teacher assignments so we can show class comparison
  let teacherByStudent = new Map<string, string>();
  if (isPercentage) {
    const teacherRows = await prisma.assessmentResult.findMany({
      where: { tenantId: user.tenantId, assessmentId: assessment.id, status: "PRESENT" },
      select: {
        studentId: true,
        student: {
          select: {
            subjectTeachers: {
              where: {
                tenantId: user.tenantId,
                subject: { name: subjectName },
                effectiveTo: null,
              },
              select: { teacher: { select: { fullName: true } } },
              take: 1,
            },
          },
        },
      },
    });
    for (const row of teacherRows) {
      const teacherName = row.student.subjectTeachers[0]?.teacher?.fullName;
      if (teacherName) teacherByStudent.set(row.studentId, teacherName);
    }
  }

  // Build per-student average on the assessment's native scale
  const sumMap = new Map<string, number>();
  const countMap = new Map<string, number>();
  for (const a of allAssessments) {
    for (const r of a.results) {
      if (!hasRecordedGrade(r.rawValue, a.gradeFormat, a.maxScore)) continue;
      let score: number | null = null;
      if (isGcse) {
        score = r.normalizedScore !== null ? r.normalizedScore * 9 : null;
      } else if (isPercentage) {
        score = r.normalizedScore !== null ? round1(r.normalizedScore * 100) : null;
      } else {
        score = A_LEVEL_SCORE[r.rawValue.trim().toUpperCase()] ?? null;
      }
      if (score !== null) {
        sumMap.set(r.studentId, (sumMap.get(r.studentId) ?? 0) + score);
        countMap.set(r.studentId, (countMap.get(r.studentId) ?? 0) + 1);
      }
    }
  }
  const studentAvgMap = new Map<string, number>();
  for (const [sid, sum] of sumMap.entries()) {
    studentAvgMap.set(sid, round1(sum / countMap.get(sid)!));
  }

  const graded = assessment.results.filter(
    r =>
      r.status === "PRESENT" &&
      hasRecordedGrade(r.rawValue, assessment.gradeFormat, assessment.maxScore),
  );

  // ── GCSE/A-Level distribution ─────────────────────────────────────────────
  const distribution = isGcse
    ? [9, 8, 7, 6, 5, 4, 3, 2, 1].map(g => ({
        grade: String(g),
        count: graded.filter(r => r.normalizedScore !== null && Math.round(r.normalizedScore * 9) === g).length,
      }))
    : !isPercentage
    ? A_LEVEL_ORDER.map(g => ({
        grade: g,
        count: graded.filter(r => r.rawValue.trim().toUpperCase() === g).length,
      }))
    : [];

  const distTotal = distribution.reduce((s, d) => s + d.count, 0);

  // ── PERCENTAGE distribution in 10% bands ─────────────────────────────────
  const PCT_EDGES = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  const pctDistribution = isPercentage
    ? PCT_EDGES.slice(0, -1).map((from, i) => {
        const to = PCT_EDGES[i + 1];
        const isLast = i === PCT_EDGES.length - 2;
        const count = graded.filter(r => {
          if (r.normalizedScore === null) return false;
          const s = r.normalizedScore * 100;
          return s >= from && (isLast ? s <= to : s < to);
        }).length;
        return { band: `${from}–${to}%`, from, to, count };
      })
    : [];
  const pctDistTotal = pctDistribution.reduce((s, d) => s + d.count, 0);

  // PERCENTAGE percentile thresholds: 80%+, 70%+, 60%+, 50%+
  const pctThresholds = isPercentage
    ? [80, 70, 60, 50].map(t => {
        const count = graded.filter(r => r.normalizedScore !== null && r.normalizedScore * 100 >= t).length;
        return {
          label: `${t}%+`,
          threshold: t,
          count,
          pct: pctDistTotal > 0 ? Math.round((count / pctDistTotal) * 100) : 0,
        };
      })
    : [];

  // PERCENTAGE year mean for this subject
  const pctScores = isPercentage
    ? graded.map(r => r.normalizedScore !== null ? r.normalizedScore * 100 : null).filter((s): s is number => s !== null)
    : [];
  const pctYearMean = avg(pctScores);

  // PERCENTAGE class comparison (by teacher)
  const classGroups = new Map<string, number[]>();
  if (isPercentage) {
    for (const r of graded) {
      if (r.normalizedScore === null) continue;
      const group = teacherByStudent.get(r.student.id) ?? "Unassigned";
      const list = classGroups.get(group) ?? [];
      list.push(round1(r.normalizedScore * 100));
      classGroups.set(group, list);
    }
  }
  const classComparison = [...classGroups.entries()]
    .map(([group, scores]) => ({
      group,
      count: scores.length,
      mean: round1(avg(scores) ?? 0),
      vsYearMean: round1((avg(scores) ?? 0) - (pctYearMean ?? 0)),
    }))
    .sort((a, b) => b.mean - a.mean)
    .filter(g => g.group !== "Unassigned");

  // PP / SEND gap data
  const ppResults = graded.filter(r => r.student.ppFlag);
  const nonPpResults = graded.filter(r => !r.student.ppFlag);
  const sendResults = graded.filter(r => r.student.sendFlag);
  const nonSendResults = graded.filter(r => !r.student.sendFlag);

  const ppData = isGcse ? {
    ppCount: ppResults.length,
    nonPpCount: nonPpResults.length,
    ppT4: gcseThresholdPct(ppResults, 4),
    ppT5: gcseThresholdPct(ppResults, 5),
    nonPpT4: gcseThresholdPct(nonPpResults, 4),
    nonPpT5: gcseThresholdPct(nonPpResults, 5),
    gap4: gcseThresholdPct(nonPpResults, 4) - gcseThresholdPct(ppResults, 4),
    gap5: gcseThresholdPct(nonPpResults, 5) - gcseThresholdPct(ppResults, 5),
  } : null;

  const sendData = isGcse ? {
    sendCount: sendResults.length,
    nonSendCount: nonSendResults.length,
    sendT4: gcseThresholdPct(sendResults, 4),
    sendT5: gcseThresholdPct(sendResults, 5),
    nonSendT4: gcseThresholdPct(nonSendResults, 4),
    nonSendT5: gcseThresholdPct(nonSendResults, 5),
    gap4: gcseThresholdPct(nonSendResults, 4) - gcseThresholdPct(sendResults, 4),
    gap5: gcseThresholdPct(nonSendResults, 5) - gcseThresholdPct(sendResults, 5),
  } : null;

  // PP/SEND mean gaps for PERCENTAGE
  const pctPpMean = avg(ppResults.map(r => r.normalizedScore !== null ? r.normalizedScore * 100 : null).filter((s): s is number => s !== null));
  const pctNonPpMean = avg(nonPpResults.map(r => r.normalizedScore !== null ? r.normalizedScore * 100 : null).filter((s): s is number => s !== null));
  const pctSendMean = avg(sendResults.map(r => r.normalizedScore !== null ? r.normalizedScore * 100 : null).filter((s): s is number => s !== null));
  const pctNonSendMean = avg(nonSendResults.map(r => r.normalizedScore !== null ? r.normalizedScore * 100 : null).filter((s): s is number => s !== null));

  // Build student rows with avg, diff, and rank
  const gradedScores = graded.map(r =>
    isGcse ? (r.normalizedScore !== null ? r.normalizedScore * 9 : null)
    : isPercentage ? (r.normalizedScore !== null ? round1(r.normalizedScore * 100) : null)
    : (A_LEVEL_SCORE[r.rawValue.trim().toUpperCase()] ?? null)
  );
  const ranks = competitionRank(gradedScores);

  const allStudents = graded
    .map((r, i) => {
      const thisScore = gradedScores[i];
      const studentAvg = studentAvgMap.get(r.student.id) ?? null;
      const diff = thisScore !== null && studentAvg !== null ? round1(thisScore - studentAvg) : null;
      return {
        id: r.student.id,
        name: r.student.fullName,
        year: r.student.yearGroup,
        ppFlag: r.student.ppFlag,
        sendFlag: r.student.sendFlag,
        rawValue: r.rawValue,
        normalizedScore: r.normalizedScore,
        score: thisScore,
        avg: studentAvg,
        diff,
        rank: ranks[i] ?? graded.length,
        teachingGroup: isPercentage ? (teacherByStudent.get(r.student.id) ?? null) : null,
      };
    })
    .sort((a, b) => {
      // Sort by rank (best first), then name
      if (a.rank !== b.rank) return a.rank - b.rank;
      return a.name.localeCompare(b.name);
    });

  // Apply filters from query params
  const rawParams = await searchParams;
  const filterQ = (Array.isArray(rawParams.q) ? rawParams.q[0] : rawParams.q ?? "").trim().toLowerCase();
  const filterPp = Array.isArray(rawParams.pp) ? rawParams.pp[0] : (rawParams.pp ?? "");
  const filterSend = Array.isArray(rawParams.send) ? rawParams.send[0] : (rawParams.send ?? "");

  let students = allStudents;
  if (filterQ) students = students.filter(s => s.name.toLowerCase().includes(filterQ));
  if (filterPp === "true") students = students.filter(s => s.ppFlag);
  if (filterPp === "false") students = students.filter(s => !s.ppFlag);
  if (filterSend === "true") students = students.filter(s => s.sendFlag);
  if (filterSend === "false") students = students.filter(s => !s.sendFlag);

  const hasFilters = !!(filterQ || filterPp || filterSend);
  const basePath = `/assessments/${cycleId}/points/${pointId}/subjects/${encodedSubject}`;
  const fromParam = `?from=${encodeURIComponent(basePath)}`;

  const formatLabel = isGcse ? "GCSE" : isPercentage ? (assessment.gradeFormat === "RAW" ? "Raw score" : "Percentage") : "A-Level";

  return (
    <div className="w-full space-y-8 pb-16">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[var(--on-surface-muted)]">
        <Link href="/assessments" className="calm-transition hover:text-[var(--on-surface)]">Cycles</Link>
        <span>›</span>
        <Link href={`/assessments/${cycleId}`} className="calm-transition hover:text-[var(--on-surface)]">{currentPoint.cycle.label}</Link>
        <span>›</span>
        <Link href={`/assessments/${cycleId}/points/${pointId}`} className="calm-transition hover:text-[var(--on-surface)]">{currentPoint.label}</Link>
        <span>›</span>
        <span className="text-[var(--on-surface)]">{subjectName}</span>
      </div>

      {/* Page Header */}
      <PageHeader
        eyebrow={`${currentPoint.cycle.label} · ${currentPoint.label}`}
        title={subjectName}
        subtitle={`${graded.length} students assessed · ${formatLabel}${isPercentage && pctYearMean !== null ? ` · Year mean ${round1(pctYearMean)}%` : ""}`}
      />

      {/* ── PERCENTAGE: Score distribution ──────────────────────────────── */}
      {isPercentage && pctDistTotal > 0 && (
        <div className="space-y-3">
          <SectionHeader title="Score Distribution" subtitle={`${pctDistTotal} students`} />
          <div className="rounded-2xl bg-white p-6 shadow-ambient space-y-5">
            {/* Stacked bar */}
            <div className="flex h-10 gap-0.5 overflow-hidden rounded-lg">
              {pctDistribution.map(d => {
                if (d.count === 0) return null;
                const pct = (d.count / pctDistTotal) * 100;
                const bg = d.from >= 70 ? "bg-emerald-500" : d.to <= 40 ? "bg-red-400" : "bg-blue-400";
                return (
                  <div
                    key={d.band}
                    className={`flex items-center justify-center text-[10px] font-bold text-white ${bg}`}
                    style={{ width: `${pct}%` }}
                    title={`${d.band}: ${d.count} students (${Math.round(pct)}%)`}
                  >
                    {pct > 8 && `${d.from}%`}
                  </div>
                );
              })}
            </div>

            {/* Band legend */}
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {pctDistribution.filter(d => d.count > 0).map(d => {
                const pct = Math.round((d.count / pctDistTotal) * 100);
                const bg = d.from >= 70 ? "bg-emerald-500" : d.to <= 40 ? "bg-red-400" : "bg-blue-400";
                return (
                  <div key={d.band} className="flex items-center gap-1.5">
                    <span className={`inline-block h-3 w-3 rounded-sm ${bg}`} />
                    <span className="text-xs text-[var(--on-surface-muted)]">
                      {d.band}: <span className="font-semibold text-[var(--on-surface)]">{d.count}</span> ({pct}%)
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Percentile thresholds */}
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

      {/* ── GCSE/A-Level: Grade Distribution ───────────────────────────── */}
      {!isPercentage && (
        <div className="space-y-3">
          <SectionHeader title="Grade Distribution" subtitle={`${graded.length} students`} />
          <div className="rounded-2xl bg-white p-6 shadow-ambient space-y-4">
            {distTotal > 0 ? (
              <>
                <div className="flex h-8 gap-0.5 overflow-hidden rounded-lg">
                  {distribution.map(d => {
                    if (d.count === 0) return null;
                    const pct = (d.count / distTotal) * 100;
                    const cls = isGcse ? gcseColour(d.grade) : aLevelColour(d.grade);
                    return (
                      <div key={d.grade} className={`flex items-center justify-center text-[11px] font-bold ${cls}`}
                           style={{ width: `${pct}%` }} title={`${d.grade}: ${d.count} (${Math.round(pct)}%)`}>
                        {pct > 5 && d.grade}
                      </div>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {distribution.filter(d => d.count > 0).map(d => {
                    const pct = Math.round((d.count / distTotal) * 100);
                    const cls = isGcse ? gcseColour(d.grade) : aLevelColour(d.grade);
                    return (
                      <div key={d.grade} className="flex items-center gap-1.5">
                        <span className={`inline-block h-3 w-3 rounded-sm ${cls}`} />
                        <span className="text-xs text-[var(--on-surface-muted)]">
                          Grade {d.grade}: <span className="font-semibold text-[var(--on-surface)]">{d.count}</span> ({pct}%)
                        </span>
                      </div>
                    );
                  })}
                </div>
                {isGcse && (
                  <div className="flex flex-wrap gap-3 pt-1 border-t border-[var(--outline-variant)]/20">
                    {[{ label: "4+", threshold: 4, cls: "text-amber-600" }, { label: "5+", threshold: 5, cls: "text-violet-600" }, { label: "7+", threshold: 7, cls: "text-green-600" }].map(({ label, threshold, cls }) => {
                      const count = graded.filter(r => r.normalizedScore !== null && Math.round(r.normalizedScore * 9) >= threshold).length;
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

      {/* ── PERCENTAGE: Class Comparison ───────────────────────────────── */}
      {isPercentage && classComparison.length >= 2 && (
        <div className="space-y-3">
          <SectionHeader
            title="Class Comparison"
            subtitle={`${classComparison.length} teaching groups · year mean ${pctYearMean !== null ? `${round1(pctYearMean)}%` : "—"}`}
          />
          <div className="rounded-2xl bg-white p-6 shadow-ambient">
            <div className="space-y-3">
              {classComparison.map(g => (
                <div key={g.group} className="flex items-center gap-4">
                  <span className="w-40 truncate text-sm font-medium text-[var(--on-surface)]">{g.group}</span>
                  <span className="w-10 text-right text-xs text-[var(--on-surface-muted)] tabular-nums">{g.count}</span>
                  <div className="relative flex-1 h-6 overflow-hidden rounded bg-[var(--surface-container)]">
                    <div
                      className={`absolute inset-y-0 left-0 rounded ${g.vsYearMean >= 0 ? "bg-emerald-400" : "bg-red-400"}`}
                      style={{ width: `${Math.min(100, g.mean)}%` }}
                    />
                    {/* Year mean marker */}
                    {pctYearMean !== null && (
                      <div
                        className="absolute inset-y-0 w-0.5 bg-[var(--on-surface)]/40"
                        style={{ left: `${Math.min(100, pctYearMean)}%` }}
                        title={`Year mean: ${round1(pctYearMean)}%`}
                      />
                    )}
                  </div>
                  <span className="w-12 text-right text-sm font-bold tabular-nums text-[var(--on-surface)]">{g.mean}%</span>
                  <span className={`w-16 text-right text-sm font-bold tabular-nums ${g.vsYearMean >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {g.vsYearMean > 0 ? "+" : ""}{g.vsYearMean}pp
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── PERCENTAGE: PP & SEND mean gaps ────────────────────────────── */}
      {isPercentage && (pctPpMean !== null || pctSendMean !== null) && (
        <div className="grid grid-cols-2 gap-5">
          {pctPpMean !== null && pctNonPpMean !== null && (
            <div className="space-y-3">
              <SectionHeader title="Pupil Premium Gap" subtitle={`${ppResults.length} PP · ${nonPpResults.length} Non-PP`} />
              <div className="rounded-2xl bg-white p-5 shadow-ambient space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--on-surface-muted)]">Mean score gap</span>
                  <GapBadge gap={Math.round(pctNonPpMean - pctPpMean)} />
                </div>
                {[{ label: "Non-PP", value: round1(pctNonPpMean), cls: "bg-[var(--on-surface)]" }, { label: "PP", value: round1(pctPpMean), cls: "bg-violet-400" }].map(({ label, value, cls }) => (
                  <div key={label}>
                    <div className="flex justify-between items-baseline mb-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--on-surface-muted)]">{label}</span>
                      <span className="text-lg font-bold tabular-nums text-[var(--on-surface)]">{value}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-container)]">
                      <div className={`${cls} h-full rounded-r-full`} style={{ width: `${value}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {pctSendMean !== null && pctNonSendMean !== null && (
            <div className="space-y-3">
              <SectionHeader title="SEND Gap" subtitle={`${sendResults.length} SEND · ${nonSendResults.length} Non-SEND`} />
              <div className="rounded-2xl bg-white p-5 shadow-ambient space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--on-surface-muted)]">Mean score gap</span>
                  <GapBadge gap={Math.round(pctNonSendMean - pctSendMean)} />
                </div>
                {[{ label: "Non-SEND", value: round1(pctNonSendMean), cls: "bg-[var(--on-surface)]" }, { label: "SEND", value: round1(pctSendMean), cls: "bg-blue-400" }].map(({ label, value, cls }) => (
                  <div key={label}>
                    <div className="flex justify-between items-baseline mb-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--on-surface-muted)]">{label}</span>
                      <span className="text-lg font-bold tabular-nums text-[var(--on-surface)]">{value}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-container)]">
                      <div className={`${cls} h-full rounded-r-full`} style={{ width: `${value}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── GCSE: PP & SEND gap cards ───────────────────────────────────── */}
      {isGcse && ppData && sendData && (
        <div className="grid grid-cols-2 gap-5">
          <div className="space-y-3">
            <SectionHeader title="Pupil Premium Gap" subtitle={`${ppData.ppCount} PP · ${ppData.nonPpCount} Non-PP`} />
            <div className="rounded-2xl bg-white p-5 shadow-ambient space-y-5">
              {[{ label: "4+", pp: ppData.ppT4, nonPp: ppData.nonPpT4, gap: ppData.gap4, cls: "text-amber-600" }, { label: "5+", pp: ppData.ppT5, nonPp: ppData.nonPpT5, gap: ppData.gap5, cls: "text-violet-600" }].map(({ label, pp, nonPp, gap, cls }, idx) => (
                <div key={label} className={idx > 0 ? "border-t border-[var(--outline-variant)]/20 pt-5" : ""}>
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-xs font-bold uppercase tracking-wider ${cls}`}>{label} Threshold</span>
                    <GapBadge gap={gap} />
                  </div>
                  <div className="space-y-2">
                    {[{ name: "Non-PP", val: nonPp, bar: "bg-[var(--on-surface)]" }, { name: "PP", val: pp, bar: "bg-violet-400" }].map(({ name, val, bar }) => (
                      <div key={name}>
                        <div className="flex justify-between items-baseline mb-1">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--on-surface-muted)]">{name}</span>
                          <span className="text-base font-bold tabular-nums text-[var(--on-surface)]">{val}%</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-container)]">
                          <div className={`${bar} h-full rounded-r-full`} style={{ width: `${val}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <SectionHeader title="SEND Gap" subtitle={`${sendData.sendCount} SEND · ${sendData.nonSendCount} Non-SEND`} />
            <div className="rounded-2xl bg-white p-5 shadow-ambient space-y-5">
              {[{ label: "4+", send: sendData.sendT4, nonSend: sendData.nonSendT4, gap: sendData.gap4, cls: "text-amber-600" }, { label: "5+", send: sendData.sendT5, nonSend: sendData.nonSendT5, gap: sendData.gap5, cls: "text-violet-600" }].map(({ label, send, nonSend, gap, cls }, idx) => (
                <div key={label} className={idx > 0 ? "border-t border-[var(--outline-variant)]/20 pt-5" : ""}>
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-xs font-bold uppercase tracking-wider ${cls}`}>{label} Threshold</span>
                    <GapBadge gap={gap} />
                  </div>
                  <div className="space-y-2">
                    {[{ name: "Non-SEND", val: nonSend, bar: "bg-[var(--on-surface)]" }, { name: "SEND", val: send, bar: "bg-blue-400" }].map(({ name, val, bar }) => (
                      <div key={name}>
                        <div className="flex justify-between items-baseline mb-1">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--on-surface-muted)]">{name}</span>
                          <span className="text-base font-bold tabular-nums text-[var(--on-surface)]">{val}%</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-container)]">
                          <div className={`${bar} h-full rounded-r-full`} style={{ width: `${val}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Student Table ────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <SectionHeader title="Students" subtitle={`${allStudents.length} assessed`} />

        <SubjectStudentsFilterBar
          basePath={basePath}
          defaultSearch={filterQ}
          defaultPp={filterPp}
          defaultSend={filterSend}
          hasFilters={hasFilters}
          totalShown={students.length}
          totalAll={allStudents.length}
        />

        <div className="table-shell">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-head-row text-left">
                  <th className="px-4 py-3 text-center w-10">Rank</th>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-4 py-3">Flags</th>
                  {isPercentage && <th className="px-4 py-3">Class</th>}
                  <th className="px-4 py-3 text-center">{isPercentage ? "Score" : "Grade"}</th>
                  <th className="px-4 py-3 text-center">Overall avg</th>
                  <th className="px-4 py-3 text-center">vs avg</th>
                </tr>
              </thead>
              <tbody>
                {students.length === 0 ? (
                  <tr className="table-row">
                    <td colSpan={isPercentage ? 7 : 6} className="px-5 py-8 text-center text-muted">
                      No students match your filters.
                    </td>
                  </tr>
                ) : (
                  students.map(student => {
                    const scoreNum = student.score;
                    return (
                      <tr key={student.id} className="group table-row calm-transition">

                        {/* Rank */}
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--surface-container)] text-xs font-bold tabular-nums text-[var(--on-surface-muted)]">
                            {student.rank}
                          </span>
                        </td>

                        {/* Name */}
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-container-low text-xs font-semibold text-on-surface-variant">
                              {getInitials(student.name)}
                            </div>
                            <Link href={`/students/${student.id}${fromParam}`}
                                  className="font-medium text-text calm-transition hover:text-accent">
                              {student.name}
                            </Link>
                          </div>
                        </td>

                        {/* Flags */}
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {student.sendFlag && (
                              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-blue-700">SEN</span>
                            )}
                            {student.ppFlag && (
                              <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-violet-700">PP</span>
                            )}
                            {!student.sendFlag && !student.ppFlag && (
                              <span className="text-xs text-muted">—</span>
                            )}
                          </div>
                        </td>

                        {/* Class (PERCENTAGE only) */}
                        {isPercentage && (
                          <td className="px-4 py-3 text-xs text-[var(--on-surface-muted)]">
                            {student.teachingGroup ?? "—"}
                          </td>
                        )}

                        {/* Score / Grade */}
                        <td className="px-4 py-3 text-center">
                          {isPercentage && scoreNum !== null ? (
                            <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-sm font-bold tabular-nums ${pctColour(scoreNum)}`}>
                              {student.rawValue}
                            </span>
                          ) : !isPercentage ? (
                            <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold ${isGcse ? gcseColour(student.rawValue) : aLevelColour(student.rawValue)}`}>
                              {student.rawValue}
                            </span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>

                        {/* Overall average */}
                        <td className="px-4 py-3 text-center">
                          {student.avg !== null ? (
                            <span className="font-semibold tabular-nums text-text">
                              {isPercentage ? `${student.avg}%` : student.avg.toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>

                        {/* vs avg */}
                        <td className="px-4 py-3 text-center">
                          {student.diff !== null ? (
                            <span className={`font-semibold tabular-nums ${student.diff > 0.05 ? "text-emerald-600" : student.diff < -0.05 ? "text-red-600" : "text-[var(--on-surface-muted)]"}`}>
                              {student.diff > 0.05 ? "+" : ""}{isPercentage ? `${student.diff}pp` : student.diff.toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="border-t border-border/20 px-5 py-3.5">
            <p className="text-[0.8125rem] text-muted">
              Showing <span className="font-semibold text-text">{students.length}</span> of{" "}
              <span className="font-semibold text-text">{allStudents.length}</span> students in {subjectName}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
