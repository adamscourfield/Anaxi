/**
 * Subject Detail Page
 *
 * Drill-down for a single subject within a result point.
 * Shows grade distribution, PP gap, SEND gap, and student-level data with:
 *  - Average grade across all subjects + diff vs this subject
 *  - Filter/search by name, PP, SEND
 *  - Student links carry ?from= for contextual back navigation
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
  if (n >= 6) return "bg-blue-500 text-text";
  if (n >= 5) return "bg-violet-500 text-white";
  if (n >= 4) return "bg-amber-500 text-text";
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

function gradeColour(g: string, format: GradeFormat): string {
  return format === "GCSE" ? gcseColour(g) : aLevelColour(g);
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

function DiffCell({ diff }: { diff: number | null }) {
  if (diff === null) return <span className="text-muted tabular-nums">—</span>;
  const abs = Math.abs(diff);
  if (abs < 0.1) return <span className="text-muted tabular-nums">±0.0</span>;
  const sign = diff > 0 ? "+" : "−";
  const colour = diff > 0
    ? "text-emerald-600"
    : "text-red-600";
  return (
    <span className={`font-semibold tabular-nums ${colour}`}>
      {sign}{abs.toFixed(1)}
    </span>
  );
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

  // Build per-student average (on the grade's native scale)
  const sumMap = new Map<string, number>();
  const countMap = new Map<string, number>();
  for (const a of allAssessments) {
    for (const r of a.results) {
      const score = isGcse
        ? (r.normalizedScore !== null ? r.normalizedScore * 9 : null)
        : (A_LEVEL_SCORE[r.rawValue.trim().toUpperCase()] ?? null);
      if (score !== null) {
        sumMap.set(r.studentId, (sumMap.get(r.studentId) ?? 0) + score);
        countMap.set(r.studentId, (countMap.get(r.studentId) ?? 0) + 1);
      }
    }
  }
  const studentAvgMap = new Map<string, number>();
  for (const [sid, sum] of sumMap.entries()) {
    studentAvgMap.set(sid, sum / countMap.get(sid)!);
  }

  const present = assessment.results.filter(r => r.status === "PRESENT");

  // Grade distribution
  const distribution = isGcse
    ? [9, 8, 7, 6, 5, 4, 3, 2, 1].map(g => ({
        grade: String(g),
        count: present.filter(r => r.normalizedScore !== null && Math.round(r.normalizedScore * 9) === g).length,
      }))
    : A_LEVEL_ORDER.map(g => ({
        grade: g,
        count: present.filter(r => r.rawValue.trim().toUpperCase() === g).length,
      }));

  const distTotal = distribution.reduce((s, d) => s + d.count, 0);

  // PP / SEND gap data (GCSE only)
  const ppResults = assessment.results.filter(r => r.student.ppFlag);
  const nonPpResults = assessment.results.filter(r => !r.student.ppFlag);
  const sendResults = assessment.results.filter(r => r.student.sendFlag);
  const nonSendResults = assessment.results.filter(r => !r.student.sendFlag);

  const ppData = isGcse ? {
    ppCount: ppResults.filter(r => r.status === "PRESENT").length,
    nonPpCount: nonPpResults.filter(r => r.status === "PRESENT").length,
    ppT4: gcseThresholdPct(ppResults, 4),
    ppT5: gcseThresholdPct(ppResults, 5),
    nonPpT4: gcseThresholdPct(nonPpResults, 4),
    nonPpT5: gcseThresholdPct(nonPpResults, 5),
    gap4: gcseThresholdPct(nonPpResults, 4) - gcseThresholdPct(ppResults, 4),
    gap5: gcseThresholdPct(nonPpResults, 5) - gcseThresholdPct(ppResults, 5),
  } : null;

  const sendData = isGcse ? {
    sendCount: sendResults.filter(r => r.status === "PRESENT").length,
    nonSendCount: nonSendResults.filter(r => r.status === "PRESENT").length,
    sendT4: gcseThresholdPct(sendResults, 4),
    sendT5: gcseThresholdPct(sendResults, 5),
    nonSendT4: gcseThresholdPct(nonSendResults, 4),
    nonSendT5: gcseThresholdPct(nonSendResults, 5),
    gap4: gcseThresholdPct(nonSendResults, 4) - gcseThresholdPct(sendResults, 4),
    gap5: gcseThresholdPct(nonSendResults, 5) - gcseThresholdPct(sendResults, 5),
  } : null;

  // Build student rows with avg + diff
  const allStudents = present
    .map(r => {
      const thisGrade = isGcse
        ? (r.normalizedScore !== null ? r.normalizedScore * 9 : null)
        : (A_LEVEL_SCORE[r.rawValue.trim().toUpperCase()] ?? null);
      const avg = studentAvgMap.get(r.student.id) ?? null;
      const diff = thisGrade !== null && avg !== null ? thisGrade - avg : null;
      return {
        id: r.student.id,
        name: r.student.fullName,
        year: r.student.yearGroup,
        ppFlag: r.student.ppFlag,
        sendFlag: r.student.sendFlag,
        rawValue: r.rawValue,
        normalizedScore: r.normalizedScore,
        avg,
        diff,
      };
    })
    .sort((a, b) => {
      if (isGcse) {
        const aScore = a.normalizedScore ?? -1;
        const bScore = b.normalizedScore ?? -1;
        if (aScore !== bScore) return bScore - aScore;
      } else {
        const aIdx = A_LEVEL_ORDER.indexOf(a.rawValue.toUpperCase() as typeof A_LEVEL_ORDER[number]);
        const bIdx = A_LEVEL_ORDER.indexOf(b.rawValue.toUpperCase() as typeof A_LEVEL_ORDER[number]);
        if (aIdx !== bIdx) return aIdx - bIdx;
      }
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

  // ?from= param for student back navigation
  const fromParam = `?from=${encodeURIComponent(basePath)}`;

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
        subtitle={`${present.length} students assessed · ${assessment.gradeFormat === "GCSE" ? "GCSE" : "A-Level"}`}
      />

      {/* Grade Distribution */}
      <div className="space-y-3">
        <SectionHeader title="Grade Distribution" subtitle={`${present.length} students`} />
        <div className="rounded-2xl bg-white p-6 shadow-ambient space-y-4">
          {distTotal > 0 ? (
            <>
              {/* Stacked bar */}
              <div className="flex h-8 gap-0.5 overflow-hidden rounded-lg">
                {distribution.map(d => {
                  if (d.count === 0) return null;
                  const pct = (d.count / distTotal) * 100;
                  const cls = gradeColour(d.grade, assessment.gradeFormat);
                  return (
                    <div
                      key={d.grade}
                      className={`flex items-center justify-center text-[11px] font-bold ${cls}`}
                      style={{ width: `${pct}%` }}
                      title={`${d.grade}: ${d.count} (${Math.round(pct)}%)`}
                    >
                      {pct > 5 && d.grade}
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {distribution.filter(d => d.count > 0).map(d => {
                  const pct = Math.round((d.count / distTotal) * 100);
                  const cls = gradeColour(d.grade, assessment.gradeFormat);
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

              {/* GCSE threshold markers */}
              {isGcse && (
                <div className="flex flex-wrap gap-3 pt-1 border-t border-[var(--outline-variant)]/20">
                  {[
                    { label: "4+", threshold: 4, cls: "text-amber-600" },
                    { label: "5+", threshold: 5, cls: "text-violet-600" },
                    { label: "7+", threshold: 7, cls: "text-green-600" },
                  ].map(({ label, threshold, cls }) => {
                    const count = present.filter(r => r.normalizedScore !== null && Math.round(r.normalizedScore * 9) >= threshold).length;
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

      {/* PP & SEND Gap Cards (GCSE only) */}
      {isGcse && ppData && sendData && (
        <div className="grid grid-cols-2 gap-5">
          {/* PP Gap */}
          <div className="space-y-3">
            <SectionHeader title="Pupil Premium Gap" subtitle={`${ppData.ppCount} PP · ${ppData.nonPpCount} Non-PP`} />
            <div className="rounded-2xl bg-white p-5 shadow-ambient space-y-5">
              {/* 4+ threshold */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-600">4+ Threshold</span>
                  <GapBadge gap={ppData.gap4} />
                </div>
                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--on-surface)]">Non-PP</span>
                      <span className="text-base font-bold tabular-nums text-[var(--on-surface)]">{ppData.nonPpT4}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-container)]">
                      <div className="bg-[var(--on-surface)] h-full rounded-r-full" style={{ width: `${ppData.nonPpT4}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-violet-500">PP</span>
                      <span className="text-base font-bold tabular-nums text-violet-500">{ppData.ppT4}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-container)]">
                      <div className="bg-violet-400 h-full rounded-r-full" style={{ width: `${ppData.ppT4}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-[var(--outline-variant)]/20" />

              {/* 5+ threshold */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-violet-600">5+ Threshold</span>
                  <GapBadge gap={ppData.gap5} />
                </div>
                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--on-surface)]">Non-PP</span>
                      <span className="text-base font-bold tabular-nums text-[var(--on-surface)]">{ppData.nonPpT5}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-container)]">
                      <div className="bg-[var(--on-surface)] h-full rounded-r-full" style={{ width: `${ppData.nonPpT5}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-violet-500">PP</span>
                      <span className="text-base font-bold tabular-nums text-violet-500">{ppData.ppT5}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-container)]">
                      <div className="bg-violet-400 h-full rounded-r-full" style={{ width: `${ppData.ppT5}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SEND Gap */}
          <div className="space-y-3">
            <SectionHeader title="SEND Gap" subtitle={`${sendData.sendCount} SEND · ${sendData.nonSendCount} Non-SEND`} />
            <div className="rounded-2xl bg-white p-5 shadow-ambient space-y-5">
              {/* 4+ threshold */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-600">4+ Threshold</span>
                  <GapBadge gap={sendData.gap4} />
                </div>
                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--on-surface)]">Non-SEND</span>
                      <span className="text-base font-bold tabular-nums text-[var(--on-surface)]">{sendData.nonSendT4}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-container)]">
                      <div className="bg-[var(--on-surface)] h-full rounded-r-full" style={{ width: `${sendData.nonSendT4}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-blue-500">SEND</span>
                      <span className="text-base font-bold tabular-nums text-blue-500">{sendData.sendT4}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-container)]">
                      <div className="bg-blue-400 h-full rounded-r-full" style={{ width: `${sendData.sendT4}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-[var(--outline-variant)]/20" />

              {/* 5+ threshold */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-violet-600">5+ Threshold</span>
                  <GapBadge gap={sendData.gap5} />
                </div>
                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--on-surface)]">Non-SEND</span>
                      <span className="text-base font-bold tabular-nums text-[var(--on-surface)]">{sendData.nonSendT5}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-container)]">
                      <div className="bg-[var(--on-surface)] h-full rounded-r-full" style={{ width: `${sendData.nonSendT5}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-blue-500">SEND</span>
                      <span className="text-base font-bold tabular-nums text-blue-500">{sendData.sendT5}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-container)]">
                      <div className="bg-blue-400 h-full rounded-r-full" style={{ width: `${sendData.sendT5}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Student List */}
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
                  <th className="px-5 py-3">Name</th>
                  <th className="px-4 py-3">Year</th>
                  <th className="px-4 py-3">Flags</th>
                  <th className="px-4 py-3 text-center">Grade</th>
                  <th className="px-4 py-3 text-center">Overall avg</th>
                  <th className="px-4 py-3 text-center">vs avg</th>
                </tr>
              </thead>
              <tbody>
                {students.length === 0 ? (
                  <tr className="table-row">
                    <td colSpan={6} className="px-5 py-8 text-center text-muted">
                      No students match your filters.
                    </td>
                  </tr>
                ) : (
                  students.map(student => (
                    <tr key={student.id} className="group table-row calm-transition">
                      {/* Name */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-container-low text-xs font-semibold text-on-surface-variant">
                            {getInitials(student.name)}
                          </div>
                          <Link
                            href={`/students/${student.id}${fromParam}`}
                            className="font-medium text-text calm-transition hover:text-accent"
                          >
                            {student.name}
                          </Link>
                        </div>
                      </td>

                      {/* Year */}
                      <td className="px-4 py-4 text-muted">
                        {student.year ? `Year ${student.year}` : "—"}
                      </td>

                      {/* Flags */}
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          {student.sendFlag && (
                            <span className="rounded bg-primary-container px-2 py-0.5 text-[10px] font-semibold uppercase text-on-primary">
                              SEN
                            </span>
                          )}
                          {student.ppFlag && (
                            <span className="rounded bg-primary-container px-2 py-0.5 text-[10px] font-semibold uppercase text-on-primary">
                              PP
                            </span>
                          )}
                          {!student.sendFlag && !student.ppFlag && (
                            <span className="text-xs text-muted">—</span>
                          )}
                        </div>
                      </td>

                      {/* Grade */}
                      <td className="px-4 py-4 text-center">
                        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold ${gradeColour(student.rawValue, assessment.gradeFormat)}`}>
                          {student.rawValue}
                        </span>
                      </td>

                      {/* Overall average */}
                      <td className="px-4 py-4 text-center">
                        {student.avg !== null ? (
                          <span className="font-semibold tabular-nums text-text">
                            {student.avg.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>

                      {/* Diff vs avg */}
                      <td className="px-4 py-4 text-center">
                        <DiffCell diff={student.diff} />
                      </td>
                    </tr>
                  ))
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
