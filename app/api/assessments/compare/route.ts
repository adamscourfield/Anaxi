/**
 * GET /api/assessments/compare
 *
 * Compare two result points within the same cycle.
 *
 * Query params:
 *   fromPointId
 *   toPointId
 *   yearGroup (optional)
 */

import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { displayGrade } from "@/modules/assessments/gradeNormalizer";
import type { GradeFormat } from "@prisma/client";
import { withApi } from "@/lib/apiRoute";

const A_LEVEL_SCORE: Record<string, number> = {
  "A*": 7, A: 6, B: 5, C: 4, D: 3, E: 2, U: 1,
};
const A_LEVEL_ORDER = ["A*", "A", "B", "C", "D", "E", "U"] as const;

function gcseThresholdPct(
  results: Array<{ normalizedScore: number | null; status: string }>,
  threshold: number
): number {
  const present = results.filter((r) => r.status === "PRESENT");
  if (present.length === 0) return 0;
  const above = present.filter(
    (r) => r.normalizedScore !== null && Math.round(r.normalizedScore * 9) >= threshold
  );
  return Math.round((above.length / present.length) * 100);
}

function aLevelThresholdPct(
  results: Array<{ rawValue: string; status: string }>,
  minScore: number
): number {
  const present = results.filter((r) => r.status === "PRESENT");
  if (present.length === 0) return 0;
  const above = present.filter((r) => (A_LEVEL_SCORE[r.rawValue.trim().toUpperCase()] ?? 0) >= minScore);
  return Math.round((above.length / present.length) * 100);
}

function normScore(rawValue: string, format: GradeFormat, maxScore?: number | null): number | null {
  if (format === "GCSE") {
    const n = parseFloat(rawValue);
    if (isNaN(n)) return null;
    return Math.max(0, Math.min(9, n)) / 9;
  }
  if (format === "A_LEVEL") {
    const s = A_LEVEL_SCORE[rawValue.trim().toUpperCase()];
    return s !== undefined ? s / 7 : null;
  }
  if (format === "PERCENTAGE") {
    const n = parseFloat(rawValue.replace(/%$/, ""));
    return isNaN(n) ? null : n / 100;
  }
  if (format === "RAW" && maxScore) {
    const n = parseFloat(rawValue);
    return isNaN(n) ? null : n / maxScore;
  }
  return null;
}

export const GET = withApi(async function GET(req: Request) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ASSESSMENTS");

  const { searchParams } = new URL(req.url);
  const fromPointId = searchParams.get("fromPointId");
  const toPointId = searchParams.get("toPointId");
  const yearGroup = searchParams.get("yearGroup") || undefined;

  if (!fromPointId || !toPointId) {
    return NextResponse.json({ error: "fromPointId and toPointId are required" }, { status: 400 });
  }

  // Load both points with their assessments
  const [fromPoint, toPoint] = await Promise.all([
    prisma.assessmentPoint.findFirst({
      where: { id: fromPointId, tenantId: user.tenantId },
      include: {
        cycle: { select: { id: true, label: true, qualificationType: true } },
        assessments: {
          where: { tenantId: user.tenantId, ...(yearGroup ? { yearGroup } : {}) },
          include: {
            results: {
              where: { tenantId: user.tenantId },
              select: {
                studentId: true,
                rawValue: true,
                normalizedScore: true,
                status: true,
                student: { select: { fullName: true, ppFlag: true, sendFlag: true, yearGroup: true } },
              },
            },
          },
        },
      },
    }),
    prisma.assessmentPoint.findFirst({
      where: { id: toPointId, tenantId: user.tenantId },
      include: {
        cycle: { select: { id: true, label: true, qualificationType: true } },
        assessments: {
          where: { tenantId: user.tenantId, ...(yearGroup ? { yearGroup } : {}) },
          include: {
            results: {
              where: { tenantId: user.tenantId },
              select: {
                studentId: true,
                rawValue: true,
                normalizedScore: true,
                status: true,
                student: { select: { fullName: true, ppFlag: true, sendFlag: true, yearGroup: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  if (!fromPoint || !toPoint) {
    return NextResponse.json({ error: "One or both result points not found" }, { status: 404 });
  }

  if (fromPoint.cycle.id !== toPoint.cycle.id) {
    return NextResponse.json(
      { error: "Both result points must belong to the same cycle" },
      { status: 400 }
    );
  }

  // Build per-student comparison
  const fromResultsBySubject = new Map<string, typeof fromPoint.assessments[0]["results"]>();
  const toResultsBySubject = new Map<string, typeof toPoint.assessments[0]["results"]>();

  for (const a of fromPoint.assessments) {
    fromResultsBySubject.set(a.subject, a.results);
  }
  for (const a of toPoint.assessments) {
    toResultsBySubject.set(a.subject, a.results);
  }

  const allSubjects = [...new Set([...fromResultsBySubject.keys(), ...toResultsBySubject.keys()])].sort();

  const subjectComparisons = allSubjects.map((subject) => {
    const fromA = fromPoint.assessments.find((a) => a.subject === subject);
    const toA = toPoint.assessments.find((a) => a.subject === subject);
    const fromResults = fromResultsBySubject.get(subject) ?? [];
    const toResults = toResultsBySubject.get(subject) ?? [];

    if (!fromA && !toA) return null;
    const fmt = (fromA ?? toA)!.gradeFormat as GradeFormat;
    const maxScore = (fromA ?? toA)!.maxScore;

    // Build student-level map
    const fromMap = new Map(fromResults.map((r) => [r.studentId, r]));
    const toMap = new Map(toResults.map((r) => [r.studentId, r]));
    const studentIds = [...new Set([...fromMap.keys(), ...toMap.keys()])];

    const studentDeltas = studentIds.map((sid) => {
      const fr = fromMap.get(sid);
      const tr = toMap.get(sid);
      const fromNorm = fr?.status === "PRESENT" ? (fr.normalizedScore ?? normScore(fr.rawValue, fmt, maxScore)) : null;
      const toNorm = tr?.status === "PRESENT" ? (tr.normalizedScore ?? normScore(tr.rawValue, fmt, maxScore)) : null;
      const delta = fromNorm !== null && toNorm !== null ? toNorm - fromNorm : null;
      return {
        studentId: sid,
        name: (fr ?? tr)!.student.fullName,
        ppFlag: (fr ?? tr)!.student.ppFlag,
        sendFlag: (fr ?? tr)!.student.sendFlag,
        from: fr?.rawValue ?? null,
        to: tr?.rawValue ?? null,
        fromNorm,
        toNorm,
        delta,
      };
    });

    const present = studentDeltas.filter((s) => s.delta !== null);
    const improved = present.filter((s) => s.delta! > 0.001).length;
    const declined = present.filter((s) => s.delta! < -0.001).length;
    const unchanged = present.length - improved - declined;

    const fromPresent = fromResults.filter((r) => r.status === "PRESENT");
    const toPresent = toResults.filter((r) => r.status === "PRESENT");

    // Threshold deltas
    const thresholdDelta =
      fmt === "GCSE"
        ? {
            "4+": {
              from: gcseThresholdPct(fromResults, 4),
              to: gcseThresholdPct(toResults, 4),
            },
            "5+": {
              from: gcseThresholdPct(fromResults, 5),
              to: gcseThresholdPct(toResults, 5),
            },
            "7+": {
              from: gcseThresholdPct(fromResults, 7),
              to: gcseThresholdPct(toResults, 7),
            },
          }
        : fmt === "A_LEVEL"
        ? {
            "A+": {
              from: aLevelThresholdPct(fromResults.map((r) => ({ rawValue: r.rawValue, status: r.status })), 6),
              to: aLevelThresholdPct(toResults.map((r) => ({ rawValue: r.rawValue, status: r.status })), 6),
            },
            "B+": {
              from: aLevelThresholdPct(fromResults.map((r) => ({ rawValue: r.rawValue, status: r.status })), 5),
              to: aLevelThresholdPct(toResults.map((r) => ({ rawValue: r.rawValue, status: r.status })), 5),
            },
            "C+": {
              from: aLevelThresholdPct(fromResults.map((r) => ({ rawValue: r.rawValue, status: r.status })), 4),
              to: aLevelThresholdPct(toResults.map((r) => ({ rawValue: r.rawValue, status: r.status })), 4),
            },
          }
        : {};

    const fromScores = fromPresent.map((r) => r.normalizedScore).filter((s): s is number => s !== null);
    const toScores = toPresent.map((r) => r.normalizedScore).filter((s): s is number => s !== null);
    const fromMean = fromScores.length > 0 ? fromScores.reduce((a, b) => a + b, 0) / fromScores.length : null;
    const toMean = toScores.length > 0 ? toScores.reduce((a, b) => a + b, 0) / toScores.length : null;

    return {
      subject,
      gradeFormat: fmt,
      fromCount: fromPresent.length,
      toCount: toPresent.length,
      fromMean,
      toMean,
      meanDelta: fromMean !== null && toMean !== null ? toMean - fromMean : null,
      improved,
      declined,
      unchanged,
      thresholdDelta,
      students: studentDeltas.sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0)),
    };
  }).filter(Boolean);

  // Overall summary across all subjects
  const allDeltas = subjectComparisons.flatMap((sc) =>
    sc!.students.map((s) => s.delta).filter((d): d is number => d !== null)
  );
  const avgDelta = allDeltas.length > 0 ? allDeltas.reduce((a, b) => a + b, 0) / allDeltas.length : null;
  const totalImproved = subjectComparisons.reduce((s, sc) => s + sc!.improved, 0);
  const totalDeclined = subjectComparisons.reduce((s, sc) => s + sc!.declined, 0);
  const totalUnchanged = subjectComparisons.reduce((s, sc) => s + sc!.unchanged, 0);

  return NextResponse.json({
    fromPoint: {
      id: fromPoint.id,
      label: fromPoint.label,
      pointType: fromPoint.pointType,
      resultStatus: fromPoint.resultStatus,
    },
    toPoint: {
      id: toPoint.id,
      label: toPoint.label,
      pointType: toPoint.pointType,
      resultStatus: toPoint.resultStatus,
      isFinalPoint: toPoint.isFinalPoint,
    },
    cycle: fromPoint.cycle,
    summary: {
      avgDelta,
      totalImproved,
      totalDeclined,
      totalUnchanged,
      subjectsCompared: subjectComparisons.length,
    },
    subjects: subjectComparisons,
  });
});
