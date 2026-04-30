/**
 * GET /api/assessments/metrics/pastoral
 *
 * Correlates behaviour/pastoral data with assessment performance for a result point.
 * Groups students into grade bands (format-specific) and returns aggregated pastoral
 * metrics + per-student drillable data.
 *
 * Grade bands:
 *   GCSE        — 1–3 | 4–5 | 6–7 | 8–9
 *   A_LEVEL     — U–E | D–C | B   | A–A*
 *   PERCENTAGE  — 0–39% | 40–59% | 60–79% | 80%+
 *   RAW         — same as PERCENTAGE (normalised score used)
 *
 * Snapshot selection: the snapshot whose snapshotDate is closest to the point's assessedAt.
 *
 * Query params:
 *   pointId — required
 */

import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import type { GradeFormat } from "@prisma/client";

// ─── Grade band definitions ───────────────────────────────────────────────────

type GradeBand = { label: string; order: number };

const GCSE_BANDS: GradeBand[] = [
  { label: "1–3", order: 0 },
  { label: "4–5", order: 1 },
  { label: "6–7", order: 2 },
  { label: "8–9", order: 3 },
];

const A_LEVEL_BANDS: GradeBand[] = [
  { label: "U–E", order: 0 },
  { label: "D–C", order: 1 },
  { label: "B",   order: 2 },
  { label: "A–A*", order: 3 },
];

const PCT_BANDS: GradeBand[] = [
  { label: "0–39%",  order: 0 },
  { label: "40–59%", order: 1 },
  { label: "60–79%", order: 2 },
  { label: "80%+",   order: 3 },
];

const A_LEVEL_SCORE: Record<string, number> = {
  "A*": 7, A: 6, B: 5, C: 4, D: 3, E: 2, U: 1,
};

function gcseBand(score: number | null): string | null {
  if (score === null) return null;
  const g = Math.round(score * 9); // normalised 0–1 → grade 1–9
  if (g <= 3) return "1–3";
  if (g <= 5) return "4–5";
  if (g <= 7) return "6–7";
  return "8–9";
}

function aLevelBand(rawValue: string): string | null {
  const grade = rawValue.trim().toUpperCase();
  const s = A_LEVEL_SCORE[grade];
  if (s === undefined) return null;
  if (s <= 2) return "U–E";  // U(1), E(2)
  if (s <= 4) return "D–C";  // D(3), C(4)
  if (s === 5) return "B";
  return "A–A*";             // A(6), A*(7)
}

function pctBand(score: number | null): string | null {
  if (score === null) return null;
  const pct = score * 100; // normalised 0–1 → 0–100
  if (pct < 40) return "0–39%";
  if (pct < 60) return "40–59%";
  if (pct < 80) return "60–79%";
  return "80%+";
}

function assignBand(format: GradeFormat, normalizedScore: number | null, rawValue: string): string | null {
  if (format === "GCSE") return gcseBand(normalizedScore);
  if (format === "A_LEVEL") return aLevelBand(rawValue);
  return pctBand(normalizedScore); // PERCENTAGE + RAW
}

function getBands(format: GradeFormat): GradeBand[] {
  if (format === "GCSE") return GCSE_BANDS;
  if (format === "A_LEVEL") return A_LEVEL_BANDS;
  return PCT_BANDS;
}

// ─── Snapshot matching ────────────────────────────────────────────────────────

function closestSnapshot(
  snapshots: Array<{ snapshotDate: Date; attendancePct: unknown; latenessCount: number; detentionsCount: number; internalExclusionsCount: number; suspensionsCount: number; onCallsCount: number; positivePointsTotal: number; negativePointsTotal: number }>,
  targetDate: Date
): typeof snapshots[number] | null {
  if (!snapshots.length) return null;
  return snapshots.reduce((best, snap) => {
    const bestDiff = Math.abs(best.snapshotDate.getTime() - targetDate.getTime());
    const snapDiff = Math.abs(snap.snapshotDate.getTime() - targetDate.getTime());
    return snapDiff < bestDiff ? snap : best;
  });
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ASSESSMENTS");

  const { searchParams } = new URL(req.url);
  const pointId = searchParams.get("pointId");

  if (!pointId) {
    return NextResponse.json({ error: "pointId is required" }, { status: 400 });
  }

  // ── 1. Load the result point (for assessedAt) ────────────────────────────
  const point = await prisma.assessmentPoint.findFirst({
    where: { id: pointId, tenantId: user.tenantId },
    select: { assessedAt: true },
  });
  if (!point) {
    return NextResponse.json({ error: "Point not found" }, { status: 404 });
  }
  const assessedAt = point.assessedAt;

  // ── 2. Load all assessments + results for this point ────────────────────
  const assessments = await prisma.assessment.findMany({
    where: { tenantId: user.tenantId, pointId },
    select: {
      id: true,
      subject: true,
      gradeFormat: true,
      results: {
        where: { tenantId: user.tenantId, status: "PRESENT" },
        select: {
          studentId: true,
          normalizedScore: true,
          rawValue: true,
          student: {
            select: {
              id: true,
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

  // ── 3. Determine dominant format ─────────────────────────────────────────
  const formatCounts: Record<string, number> = {};
  for (const a of assessments) {
    formatCounts[a.gradeFormat] = (formatCounts[a.gradeFormat] ?? 0) + a.results.length;
  }
  const dominantFormat = Object.entries(formatCounts).sort((a, b) => b[1] - a[1])[0]?.[0] as GradeFormat ?? "GCSE";

  // ── 4. Flatten results; compute per-student overall mean score ───────────
  // Use the subject whose gradeFormat matches dominantFormat (or all if mixed).
  const studentScores: Map<string, { scores: number[]; rawValues: string[]; name: string; ppFlag: boolean; sendFlag: boolean; yearGroup: string }> = new Map();

  for (const a of assessments) {
    if (a.gradeFormat !== dominantFormat) continue;
    for (const r of a.results) {
      const existing = studentScores.get(r.studentId) ?? {
        scores: [],
        rawValues: [],
        name: r.student.fullName,
        ppFlag: r.student.ppFlag,
        sendFlag: r.student.sendFlag,
        yearGroup: r.student.yearGroup ?? "",
      };
      if (r.normalizedScore !== null) existing.scores.push(r.normalizedScore);
      existing.rawValues.push(r.rawValue);
      studentScores.set(r.studentId, existing);
    }
  }

  // ── 5. Load snapshots for all relevant students ──────────────────────────
  const studentIds = Array.from(studentScores.keys());
  if (!studentIds.length) {
    return NextResponse.json({ error: "No student results found" }, { status: 404 });
  }

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

  // Group by student
  const snapshotsByStudent = new Map<string, typeof allSnapshots>();
  for (const s of allSnapshots) {
    const arr = snapshotsByStudent.get(s.studentId) ?? [];
    arr.push(s);
    snapshotsByStudent.set(s.studentId, arr);
  }

  // ── 6. Assign each student to a band and collect pastoral data ───────────
  const bands = getBands(dominantFormat);
  type StudentPastoralRow = {
    studentId: string;
    name: string;
    ppFlag: boolean;
    sendFlag: boolean;
    yearGroup: string;
    bandLabel: string;
    // Assessment
    meanScore: number | null;  // normalised 0–1
    // Pastoral (null if no snapshot)
    attendancePct: number | null;
    latenessCount: number | null;
    detentionsCount: number | null;
    internalExclusionsCount: number | null;
    suspensionsCount: number | null;
    onCallsCount: number | null;
    positivePointsTotal: number | null;
    negativePointsTotal: number | null;
    hasSnapshot: boolean;
  };

  const studentRows: StudentPastoralRow[] = [];

  for (const [studentId, data] of studentScores) {
    const meanScore = data.scores.length > 0
      ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length
      : null;

    // Pick representative raw value (first subject alphabetically)
    const repRaw = data.rawValues[0] ?? "";

    const bandLabel = meanScore !== null
      ? (assignBand(dominantFormat, meanScore, repRaw) ?? "Unknown")
      : "Unknown";

    const snaps = snapshotsByStudent.get(studentId) ?? [];
    const snap = closestSnapshot(snaps, assessedAt);

    studentRows.push({
      studentId,
      name: data.name,
      ppFlag: data.ppFlag,
      sendFlag: data.sendFlag,
      yearGroup: data.yearGroup,
      bandLabel,
      meanScore,
      attendancePct: snap ? Number(snap.attendancePct) : null,
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

  // ── 7. Aggregate by band ─────────────────────────────────────────────────
  type BandAggregate = {
    label: string;
    order: number;
    count: number;
    withSnapshot: number;
    // Means (null if no snapshots in band)
    meanAttendancePct: number | null;
    meanLatenessCount: number | null;
    meanDetentionsCount: number | null;
    meanInternalExclusionsCount: number | null;
    meanSuspensionsCount: number | null;
    meanOnCallsCount: number | null;
    // Students for drill-down modal
    students: StudentPastoralRow[];
  };

  const bandMap = new Map<string, BandAggregate>();
  for (const b of bands) {
    bandMap.set(b.label, { ...b, count: 0, withSnapshot: 0, meanAttendancePct: null, meanLatenessCount: null, meanDetentionsCount: null, meanInternalExclusionsCount: null, meanSuspensionsCount: null, meanOnCallsCount: null, students: [] });
  }

  for (const row of studentRows) {
    const band = bandMap.get(row.bandLabel);
    if (!band) continue; // "Unknown" — skip
    band.count++;
    band.students.push(row);
    if (row.hasSnapshot) band.withSnapshot++;
  }

  // Compute means for each band
  for (const band of bandMap.values()) {
    const snapped = band.students.filter((s) => s.hasSnapshot);
    if (!snapped.length) continue;
    const avg = (fn: (s: StudentPastoralRow) => number | null) => {
      const vals = snapped.map(fn).filter((v): v is number => v !== null);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    };
    band.meanAttendancePct = avg((s) => s.attendancePct);
    band.meanLatenessCount = avg((s) => s.latenessCount);
    band.meanDetentionsCount = avg((s) => s.detentionsCount);
    band.meanInternalExclusionsCount = avg((s) => s.internalExclusionsCount);
    band.meanSuspensionsCount = avg((s) => s.suspensionsCount);
    band.meanOnCallsCount = avg((s) => s.onCallsCount);
  }

  // ── 8. Overall year-group averages (baseline comparison) ─────────────────
  const withSnap = studentRows.filter((s) => s.hasSnapshot);
  const overallAvg = (fn: (s: StudentPastoralRow) => number | null) => {
    const vals = withSnap.map(fn).filter((v): v is number => v !== null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };
  const yearMeans = {
    attendancePct: overallAvg((s) => s.attendancePct),
    latenessCount: overallAvg((s) => s.latenessCount),
    detentionsCount: overallAvg((s) => s.detentionsCount),
    internalExclusionsCount: overallAvg((s) => s.internalExclusionsCount),
    suspensionsCount: overallAvg((s) => s.suspensionsCount),
    onCallsCount: overallAvg((s) => s.onCallsCount),
  };

  // ── 9. Serialise (strip Date objects from student rows for JSON) ──────────
  const bandsSerialized = bands
    .map((b) => {
      const agg = bandMap.get(b.label)!;
      return {
        label: agg.label,
        order: agg.order,
        count: agg.count,
        withSnapshot: agg.withSnapshot,
        meanAttendancePct: agg.meanAttendancePct !== null ? Math.round(agg.meanAttendancePct * 10) / 10 : null,
        meanLatenessCount: agg.meanLatenessCount !== null ? Math.round(agg.meanLatenessCount * 10) / 10 : null,
        meanDetentionsCount: agg.meanDetentionsCount !== null ? Math.round(agg.meanDetentionsCount * 10) / 10 : null,
        meanInternalExclusionsCount: agg.meanInternalExclusionsCount !== null ? Math.round(agg.meanInternalExclusionsCount * 10) / 10 : null,
        meanSuspensionsCount: agg.meanSuspensionsCount !== null ? Math.round(agg.meanSuspensionsCount * 10) / 10 : null,
        meanOnCallsCount: agg.meanOnCallsCount !== null ? Math.round(agg.meanOnCallsCount * 10) / 10 : null,
        students: agg.students.map((s) => ({
          studentId: s.studentId,
          name: s.name,
          ppFlag: s.ppFlag,
          sendFlag: s.sendFlag,
          yearGroup: s.yearGroup,
          meanScore: s.meanScore !== null ? Math.round(s.meanScore * 1000) / 1000 : null,
          attendancePct: s.attendancePct !== null ? Math.round(s.attendancePct * 10) / 10 : null,
          latenessCount: s.latenessCount,
          detentionsCount: s.detentionsCount,
          internalExclusionsCount: s.internalExclusionsCount,
          suspensionsCount: s.suspensionsCount,
          onCallsCount: s.onCallsCount,
          positivePointsTotal: s.positivePointsTotal,
          negativePointsTotal: s.negativePointsTotal,
          hasSnapshot: s.hasSnapshot,
        })),
      };
    });

  return NextResponse.json({
    pointId,
    dominantFormat,
    assessedAt: assessedAt.toISOString(),
    totalStudents: studentRows.length,
    withSnapshot: withSnap.length,
    yearMeans: {
      attendancePct: yearMeans.attendancePct !== null ? Math.round(yearMeans.attendancePct * 10) / 10 : null,
      latenessCount: yearMeans.latenessCount !== null ? Math.round(yearMeans.latenessCount * 10) / 10 : null,
      detentionsCount: yearMeans.detentionsCount !== null ? Math.round(yearMeans.detentionsCount * 10) / 10 : null,
      internalExclusionsCount: yearMeans.internalExclusionsCount !== null ? Math.round(yearMeans.internalExclusionsCount * 10) / 10 : null,
      suspensionsCount: yearMeans.suspensionsCount !== null ? Math.round(yearMeans.suspensionsCount * 10) / 10 : null,
      onCallsCount: yearMeans.onCallsCount !== null ? Math.round(yearMeans.onCallsCount * 10) / 10 : null,
    },
    bands: bandsSerialized,
  });
}
