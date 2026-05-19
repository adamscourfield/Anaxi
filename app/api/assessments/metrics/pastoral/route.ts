/**
 * GET /api/assessments/metrics/pastoral
 *
 * Returns per-student attainment + pastoral data for a result point.
 * The frontend computes quartile bands from the flat student array so that
 * the API stays format-agnostic and band boundaries can be adjusted without
 * a round-trip.
 *
 * Snapshot selection: the snapshot whose snapshotDate is closest to the
 * point's assessedAt date.
 *
 * Query params:
 *   pointId — required
 *
 * Response:
 *   dominantFormat    — grade format with the most results
 *   totalStudents     — students with at least one PRESENT result
 *   withSnapshot      — students where a snapshot was found
 *   cohortMeans       — whole-cohort averages for summary cards
 *   students[]        — one row per student; normalisedScore (0–1) used for
 *                       quartile ranking; displayScore is the human label
 */

import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import type { GradeFormat } from "@prisma/client";
import { withApi } from "@/lib/apiRoute";

// ─── Score display helpers ────────────────────────────────────────────────────

const A_LEVEL_SCORE: Record<string, number> = {
  "A*": 7, A: 6, B: 5, C: 4, D: 3, E: 2, U: 1,
};

/** Convert a mean normalised score (0–1) to a human-readable label. */
function toDisplayScore(format: GradeFormat, normScore: number | null, rawValues: string[]): string {
  if (normScore === null) return "—";
  if (format === "GCSE") {
    return (normScore * 9).toFixed(1);
  }
  if (format === "A_LEVEL") {
    // For A-Level, show the most common raw grade in the student's result set
    if (rawValues.length === 1) return rawValues[0];
    // Otherwise derive nearest grade from normalised score
    const pts = normScore * 7;
    if (pts >= 6.5) return "A*";
    if (pts >= 5.5) return "A";
    if (pts >= 4.5) return "B";
    if (pts >= 3.5) return "C";
    if (pts >= 2.5) return "D";
    if (pts >= 1.5) return "E";
    return "U";
  }
  // PERCENTAGE / RAW
  return `${Math.round(normScore * 100)}%`;
}

// ─── Snapshot matching ────────────────────────────────────────────────────────

type SnapRow = {
  studentId: string;
  snapshotDate: Date;
  attendancePct: unknown;
  latenessCount: number;
  detentionsCount: number;
  internalExclusionsCount: number;
  suspensionsCount: number;
  onCallsCount: number;
  positivePointsTotal: number;
  negativePointsTotal: number;
};

function closestSnapshot(snapshots: SnapRow[], targetDate: Date): SnapRow | null {
  if (!snapshots.length) return null;
  return snapshots.reduce((best, snap) => {
    const bestDiff = Math.abs(best.snapshotDate.getTime() - targetDate.getTime());
    const snapDiff = Math.abs(snap.snapshotDate.getTime() - targetDate.getTime());
    return snapDiff < bestDiff ? snap : best;
  });
}

// ─── Cohort mean helper ───────────────────────────────────────────────────────

function cohortAvg(vals: (number | null)[]): number | null {
  const present = vals.filter((v): v is number => v !== null);
  return present.length ? Math.round((present.reduce((a, b) => a + b, 0) / present.length) * 10) / 10 : null;
}

// ─── Route ────────────────────────────────────────────────────────────────────

export const GET = withApi(async function GET(req: Request) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ASSESSMENTS");

  const { searchParams } = new URL(req.url);
  const pointId = searchParams.get("pointId");

  if (!pointId) {
    return NextResponse.json({ error: "pointId is required" }, { status: 400 });
  }

  // ── 1. Load the result point ──────────────────────────────────────────────
  const point = await prisma.assessmentPoint.findFirst({
    where: { id: pointId, tenantId: user.tenantId },
    select: { assessedAt: true },
  });
  if (!point) {
    return NextResponse.json({ error: "Point not found" }, { status: 404 });
  }
  const assessedAt = point.assessedAt;

  // ── 2. Load all assessments + results ────────────────────────────────────
  const assessments = await prisma.assessment.findMany({
    where: { tenantId: user.tenantId, pointId },
    select: {
      gradeFormat: true,
      results: {
        where: { tenantId: user.tenantId, status: "PRESENT" },
        select: {
          studentId: true,
          normalizedScore: true,
          rawValue: true,
          student: {
            select: {
              fullName: true,
              ppFlag: true,
              sendFlag: true,
              yearGroup: true,
            },
          },
        },
      },
    },
  });

  if (!assessments.length) {
    return NextResponse.json({ error: "No assessments found for this point" }, { status: 404 });
  }

  // ── 3. Determine dominant grade format ───────────────────────────────────
  const formatCounts: Record<string, number> = {};
  for (const a of assessments) {
    formatCounts[a.gradeFormat] = (formatCounts[a.gradeFormat] ?? 0) + a.results.length;
  }
  const dominantFormat = (
    Object.entries(formatCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "GCSE"
  ) as GradeFormat;

  // ── 4. Build per-student score aggregates (dominant format only) ──────────
  type ScoreAgg = {
    scores: number[];
    rawValues: string[];
    name: string;
    ppFlag: boolean;
    sendFlag: boolean;
    yearGroup: string;
  };
  const studentAgg = new Map<string, ScoreAgg>();

  for (const a of assessments) {
    if (a.gradeFormat !== dominantFormat) continue;
    for (const r of a.results) {
      const existing = studentAgg.get(r.studentId) ?? {
        scores: [],
        rawValues: [],
        name: r.student.fullName,
        ppFlag: r.student.ppFlag,
        sendFlag: r.student.sendFlag,
        yearGroup: r.student.yearGroup ?? "",
      };
      if (r.normalizedScore !== null) existing.scores.push(r.normalizedScore);
      existing.rawValues.push(r.rawValue);
      studentAgg.set(r.studentId, existing);
    }
  }

  const studentIds = Array.from(studentAgg.keys());
  if (!studentIds.length) {
    return NextResponse.json({ error: "No student results found" }, { status: 404 });
  }

  // ── 5. Load snapshots ─────────────────────────────────────────────────────
  const allSnapshots = await prisma.studentSnapshot.findMany({
    where: { tenantId: user.tenantId, studentId: { in: studentIds } },
    select: {
      studentId: true,
      snapshotDate: true,
      attendancePct: true,
      latenessCount: true,
      detentionsCount: true,
      internalExclusionsCount: true,
      suspensionsCount: true,
      onCallsCount: true,
      positivePointsTotal: true,
      negativePointsTotal: true,
    },
    orderBy: { snapshotDate: "asc" },
  });

  // Index by student
  const snapsByStudent = new Map<string, SnapRow[]>();
  for (const s of allSnapshots) {
    const arr = snapsByStudent.get(s.studentId) ?? [];
    arr.push(s as SnapRow);
    snapsByStudent.set(s.studentId, arr);
  }

  // ── 6. Build flat student rows ────────────────────────────────────────────
  const students: Array<{
    studentId: string;
    name: string;
    ppFlag: boolean;
    sendFlag: boolean;
    yearGroup: string;
    normalisedScore: number | null;
    displayScore: string;
    attendancePct: number | null;
    latenessCount: number | null;
    detentionsCount: number | null;
    internalExclusionsCount: number | null;
    suspensionsCount: number | null;
    onCallsCount: number | null;
    positivePointsTotal: number | null;
    negativePointsTotal: number | null;
    hasSnapshot: boolean;
  }> = [];

  for (const [studentId, agg] of studentAgg) {
    const normalisedScore =
      agg.scores.length > 0
        ? agg.scores.reduce((a, b) => a + b, 0) / agg.scores.length
        : null;

    const snap = closestSnapshot(snapsByStudent.get(studentId) ?? [], assessedAt);

    students.push({
      studentId,
      name: agg.name,
      ppFlag: agg.ppFlag,
      sendFlag: agg.sendFlag,
      yearGroup: agg.yearGroup,
      normalisedScore: normalisedScore !== null ? Math.round(normalisedScore * 10000) / 10000 : null,
      displayScore: toDisplayScore(dominantFormat, normalisedScore, agg.rawValues),
      attendancePct: snap ? Math.round(Number(snap.attendancePct) * 10) / 10 : null,
      latenessCount: snap?.latenessCount ?? null,
      detentionsCount: snap?.detentionsCount ?? null,
      internalExclusionsCount: snap?.internalExclusionsCount ?? null,
      suspensionsCount: snap?.suspensionsCount ?? null,
      onCallsCount: snap?.onCallsCount ?? null,
      positivePointsTotal: snap?.positivePointsTotal ?? null,
      negativePointsTotal: snap?.negativePointsTotal ?? null,
      hasSnapshot: snap !== null,
    });
  }

  // ── 7. Cohort-level summary stats ─────────────────────────────────────────
  const snapped = students.filter((s) => s.hasSnapshot);

  const below90Count = snapped.filter(
    (s) => s.attendancePct !== null && s.attendancePct < 90
  ).length;

  const cohortMeans = {
    attendancePct: cohortAvg(snapped.map((s) => s.attendancePct)),
    latenessCount: cohortAvg(snapped.map((s) => s.latenessCount)),
    detentionsCount: cohortAvg(snapped.map((s) => s.detentionsCount)),
    internalExclusionsCount: cohortAvg(snapped.map((s) => s.internalExclusionsCount)),
    suspensionsCount: cohortAvg(snapped.map((s) => s.suspensionsCount)),
    onCallsCount: cohortAvg(snapped.map((s) => s.onCallsCount)),
    positivePointsTotal: cohortAvg(snapped.map((s) => s.positivePointsTotal)),
    below90Count,
    below90Pct:
      snapped.length > 0 ? Math.round((below90Count / snapped.length) * 1000) / 10 : 0,
  };

  // ── 8. Return ─────────────────────────────────────────────────────────────
  return NextResponse.json({
    pointId,
    dominantFormat,
    assessedAt: assessedAt.toISOString(),
    totalStudents: students.length,
    withSnapshot: snapped.length,
    cohortMeans,
    // Sort by normalisedScore descending so the frontend can slice quartiles
    // immediately without re-sorting
    students: students.sort(
      (a, b) => (b.normalisedScore ?? -1) - (a.normalisedScore ?? -1)
    ),
  });
});
