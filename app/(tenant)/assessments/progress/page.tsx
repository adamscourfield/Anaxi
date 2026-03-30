/**
 * Progress Comparison Page
 *
 * Shows a cohort's attainment across all assessment points in a cycle.
 * Rows = students, columns = assessment points.
 * Colour-coded deltas reveal who is improving or declining.
 *
 * Query params: ?cycleId=&subject=&yearGroup=
 */

import { getSessionUserOrThrow } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { MetaText } from "@/components/ui/typography";
import { displayGrade } from "@/modules/assessments/gradeNormalizer";
import Link from "next/link";
import type { GradeFormat } from "@prisma/client";

type SearchParams = {
  cycleId?: string;
  subject?: string;
  yearGroup?: string;
};

export default async function ProgressPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const user = await getSessionUserOrThrow();
  const { cycleId, subject, yearGroup } = searchParams ?? {};

  // Load cycles for the selector
  const cycles = await prisma.assessmentCycle.findMany({
    where: { tenantId: user.tenantId },
    orderBy: [{ isActive: "desc" }, { startDate: "desc" }],
    select: { id: true, label: true, isActive: true },
  });

  const selectedCycle = cycles.find((c) => c.id === cycleId) ?? cycles[0] ?? null;

  // Load available subjects + year groups for the selected cycle
  const availableAssessments = selectedCycle
    ? await prisma.assessment.findMany({
        where: { tenantId: user.tenantId, point: { cycleId: selectedCycle.id } },
        select: { subject: true, yearGroup: true },
        distinct: ["subject", "yearGroup"],
        orderBy: [{ subject: "asc" }, { yearGroup: "asc" }],
      })
    : [];

  const subjects = [...new Set(availableAssessments.map((a) => a.subject))].sort();
  const yearGroups = [
    ...new Set(
      availableAssessments
        .filter((a) => !subject || a.subject === subject)
        .map((a) => a.yearGroup)
    ),
  ].sort();

  // Determine if we have enough params to render the table
  const canRender = !!(selectedCycle && subject && yearGroup);

  // ─── Fetch data when all params are present ────────────────────────────────

  type PointCol = {
    id: string;
    label: string;
    ordinal: number;
    assessedAt: Date;
    gradeFormat: GradeFormat;
    maxScore: number | null;
    assessmentId: string;
  };

  type StudentRow = {
    studentId: string;
    studentName: string;
    yearGroupLabel: string | null;
    sendFlag: boolean;
    ppFlag: boolean;
    scores: Record<string, { normalizedScore: number | null; rawValue: string } | undefined>;
    firstScore: number | null;
    lastScore: number | null;
    delta: number | null;
  };

  let points: PointCol[] = [];
  let studentRows: StudentRow[] = [];

  if (canRender) {
    // Fetch all assessments for this cycle+subject+yearGroup, ordered by point
    const assessments = await prisma.assessment.findMany({
      where: {
        tenantId: user.tenantId,
        subject,
        yearGroup,
        point: { cycleId: selectedCycle!.id },
      },
      include: { point: true },
      orderBy: { point: { ordinal: "asc" } },
    });

    points = assessments.map((a) => ({
      id: a.point.id,
      label: a.point.label,
      ordinal: a.point.ordinal,
      assessedAt: a.point.assessedAt,
      gradeFormat: a.gradeFormat,
      maxScore: a.maxScore,
      assessmentId: a.id,
    }));

    if (points.length > 0) {
      // Fetch all results for these assessments in a single query
      const assessmentIds = assessments.map((a) => a.id);
      const results = await prisma.assessmentResult.findMany({
        where: {
          tenantId: user.tenantId,
          assessmentId: { in: assessmentIds },
        },
        include: {
          student: {
            select: {
              id: true,
              fullName: true,
              yearGroup: true,
              sendFlag: true,
              ppFlag: true,
            },
          },
        },
      });

      // Build assessment→pointId lookup
      const assessmentToPoint = new Map(assessments.map((a) => [a.id, a.point.id]));

      // Group results by student
      type ResultEntry = { normalizedScore: number | null; rawValue: string };
      const byStudent = new Map<
        string,
        {
          student: { id: string; fullName: string; yearGroup: string | null; sendFlag: boolean; ppFlag: boolean };
          scores: Map<string, ResultEntry>; // pointId → score
        }
      >();

      for (const r of results) {
        const pointId = assessmentToPoint.get(r.assessmentId);
        if (!pointId) continue;

        if (!byStudent.has(r.studentId)) {
          byStudent.set(r.studentId, {
            student: r.student,
            scores: new Map(),
          });
        }
        byStudent.get(r.studentId)!.scores.set(pointId, {
          normalizedScore: r.normalizedScore,
          rawValue: r.rawValue,
        });
      }

      // Build ordered rows
      const orderedPoints = points.sort((a, b) => a.ordinal - b.ordinal);

      studentRows = [...byStudent.values()].map(({ student, scores }) => {
        const orderedScores = orderedPoints.map((p) => scores.get(p.id)?.normalizedScore ?? null);
        const validScores = orderedScores.filter((s): s is number => s !== null);
        const firstScore = validScores[0] ?? null;
        const lastScore = validScores[validScores.length - 1] ?? null;
        const delta = firstScore !== null && lastScore !== null && firstScore !== lastScore
          ? lastScore - firstScore
          : null;

        const scoresRecord: StudentRow["scores"] = {};
        for (const p of orderedPoints) {
          scoresRecord[p.id] = scores.get(p.id);
        }

        return {
          studentId: student.id,
          studentName: student.fullName,
          yearGroupLabel: student.yearGroup,
          sendFlag: student.sendFlag,
          ppFlag: student.ppFlag,
          scores: scoresRecord,
          firstScore,
          lastScore,
          delta,
        };
      });

      // Sort by last point score descending (highest attainment first)
      studentRows.sort((a, b) => (b.lastScore ?? -1) - (a.lastScore ?? -1));
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  function deltaColour(delta: number | null): string {
    if (delta === null) return "text-muted";
    if (delta > 0.05) return "text-success font-medium";
    if (delta < -0.05) return "text-error font-medium";
    return "text-muted";
  }

  function deltaLabel(delta: number | null): string {
    if (delta === null) return "—";
    const pct = Math.round(delta * 100);
    return `${pct > 0 ? "▲" : pct < 0 ? "▼" : "="} ${Math.abs(pct)}%`;
  }

  function cellColour(score: number | null, prevScore: number | null): string {
    if (score === null) return "text-muted";
    if (prevScore === null) return "text-text";
    const delta = score - prevScore;
    if (delta > 0.05) return "text-success";
    if (delta < -0.05) return "text-error";
    return "text-text";
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-bold tracking-[-0.02em] text-text">
            Progress Comparison
          </h1>
          <MetaText>
            {canRender
              ? `${subject} · ${yearGroup} · ${selectedCycle?.label}`
              : "Select a cycle, subject, and year group"}
          </MetaText>
        </div>
        <Link href="/assessments" className="text-sm text-muted hover:underline">
          ← Assessments
        </Link>
      </div>

      {/* Selectors */}
      <Card className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          {/* Cycle */}
          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wide text-muted">
              Cycle
            </label>
            <div className="segmented-toggle">
              {cycles.map((c) => (
                <Link
                  key={c.id}
                  href={`/assessments/progress?cycleId=${c.id}${subject ? `&subject=${encodeURIComponent(subject)}` : ""}${yearGroup ? `&yearGroup=${encodeURIComponent(yearGroup)}` : ""}`}
                  className={`segmented-toggle-btn ${selectedCycle?.id === c.id ? "segmented-toggle-btn-active" : ""}`}
                >
                  {c.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Subject */}
          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wide text-muted">
              Subject
            </label>
            <div className="segmented-toggle">
              {subjects.map((s) => (
                <Link
                  key={s}
                  href={`/assessments/progress?cycleId=${selectedCycle?.id ?? ""}${s ? `&subject=${encodeURIComponent(s)}` : ""}${yearGroup ? `&yearGroup=${encodeURIComponent(yearGroup)}` : ""}`}
                  className={`segmented-toggle-btn ${subject === s ? "segmented-toggle-btn-active" : ""}`}
                >
                  {s}
                </Link>
              ))}
              {subjects.length === 0 && (
                <span className="text-sm text-muted">Select a cycle first</span>
              )}
            </div>
          </div>

          {/* Year group */}
          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wide text-muted">
              Year group
            </label>
            <div className="segmented-toggle">
              {yearGroups.map((yg) => (
                <Link
                  key={yg}
                  href={`/assessments/progress?cycleId=${selectedCycle?.id ?? ""}${subject ? `&subject=${encodeURIComponent(subject)}` : ""}&yearGroup=${encodeURIComponent(yg)}`}
                  className={`segmented-toggle-btn ${yearGroup === yg ? "segmented-toggle-btn-active" : ""}`}
                >
                  {yg}
                </Link>
              ))}
              {yearGroups.length === 0 && subjects.length > 0 && (
                <span className="text-sm text-muted">Select a subject first</span>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Progress table */}
      {canRender && (
        <>
          {studentRows.length === 0 ? (
            <Card className="py-12 text-center">
              <p className="text-muted">No results found for this combination.</p>
              <p className="mt-1 text-sm text-muted">
                Upload assessment results for{" "}
                <strong>
                  {subject} · {yearGroup}
                </strong>{" "}
                to see progress here.
              </p>
            </Card>
          ) : (
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium text-text">
                  {studentRows.length} student{studentRows.length !== 1 ? "s" : ""}
                </p>
                <Link
                  href={`/assessments/triangulation`}
                  className="text-xs text-accent hover:underline"
                >
                  View triangulated risks →
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted">
                      <th className="pb-2 pr-4 font-medium">Student</th>
                      {points.map((p) => (
                        <th key={p.id} className="pb-2 pr-3 text-center font-medium">
                          {p.label}
                        </th>
                      ))}
                      <th className="pb-2 text-center font-medium">Δ Overall</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-divider">
                    {studentRows.map((row) => {
                      const orderedPoints = points.sort((a, b) => a.ordinal - b.ordinal);
                      return (
                        <tr key={row.studentId}>
                          <td className="py-2.5 pr-4">
                            <Link
                              href={`/analysis/students/${row.studentId}`}
                              className="font-medium text-text hover:text-accent"
                            >
                              {row.studentName}
                            </Link>
                            <div className="mt-0.5 flex gap-1">
                              {row.sendFlag && (
                                <span className="rounded-full bg-cat-violet-bg px-1.5 py-0.5 text-[9px] font-medium text-cat-violet-text">
                                  SEND
                                </span>
                              )}
                              {row.ppFlag && (
                                <span className="rounded-full bg-scale-consistent-light px-1.5 py-0.5 text-[9px] font-medium text-blue-700">
                                  PP
                                </span>
                              )}
                            </div>
                          </td>
                          {orderedPoints.map((p, i) => {
                            const entry = row.scores[p.id];
                            const prevEntry = i > 0 ? row.scores[orderedPoints[i - 1].id] : undefined;
                            const colour = cellColour(
                              entry?.normalizedScore ?? null,
                              prevEntry?.normalizedScore ?? null
                            );
                            return (
                              <td key={p.id} className={`py-2.5 pr-3 text-center tabular-nums ${colour}`}>
                                {entry && entry.normalizedScore !== null
                                  ? displayGrade(entry.normalizedScore, p.gradeFormat, p.maxScore)
                                  : <span className="text-muted">—</span>}
                              </td>
                            );
                          })}
                          <td className={`py-2.5 text-center tabular-nums text-xs ${deltaColour(row.delta)}`}>
                            {deltaLabel(row.delta)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-muted">
                Green = improvement of &gt;5 percentage points · Red = decline
              </p>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
