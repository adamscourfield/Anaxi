/**
 * GET /api/assessments/key-measures
 *
 * Returns key attainment measures for a given assessment point or cycle.
 * Handles both GCSE (numeric 1-9) and A-Level (A*-U) grade formats.
 *
 * Query params:
 *   pointId   — single assessment point
 *   cycleId   — all points in a cycle (for progress view)
 *   yearGroup — filter to a specific year group
 */

import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { normalizeGrade } from "@/modules/assessments/gradeNormalizer";
import type { GradeFormat } from "@prisma/client";

// ─── GCSE threshold helpers ───────────────────────────────────────────────────

const GCSE_THRESHOLDS = [9, 8, 7, 6, 5, 4, 3, 2, 1] as const;

function gcseThresholdPct(
  results: Array<{ rawValue: string; normalizedScore: number | null; status: string }>,
  threshold: number
): number {
  const present = results.filter((r) => r.status === "PRESENT");
  if (present.length === 0) return 0;
  const above = present.filter((r) => {
    if (r.normalizedScore === null) return false;
    const grade = Math.round(r.normalizedScore * 9);
    return grade >= threshold;
  });
  return Math.round((above.length / present.length) * 100);
}

// ─── A-Level threshold helpers ────────────────────────────────────────────────

const A_LEVEL_ORDER = ["A*", "A", "B", "C", "D", "E", "U"] as const;
type ALevelGrade = (typeof A_LEVEL_ORDER)[number];

const A_LEVEL_SCORE: Record<string, number> = {
  "A*": 7, A: 6, B: 5, C: 4, D: 3, E: 2, U: 1,
};

function aLevelThresholdPct(
  results: Array<{ rawValue: string; status: string }>,
  minGrade: ALevelGrade
): number {
  const present = results.filter((r) => r.status === "PRESENT");
  if (present.length === 0) return 0;
  const minScore = A_LEVEL_SCORE[minGrade] ?? 0;
  const above = present.filter((r) => {
    const score = A_LEVEL_SCORE[r.rawValue.trim().toUpperCase()];
    return score !== undefined && score >= minScore;
  });
  return Math.round((above.length / present.length) * 100);
}

function aLevelDistribution(
  results: Array<{ rawValue: string; status: string }>
): Record<ALevelGrade, number> {
  const present = results.filter((r) => r.status === "PRESENT");
  const dist = Object.fromEntries(A_LEVEL_ORDER.map((g) => [g, 0])) as Record<ALevelGrade, number>;
  for (const r of present) {
    const g = r.rawValue.trim().toUpperCase() as ALevelGrade;
    if (g in dist) dist[g]++;
  }
  return dist;
}

// ─── GET handler ──────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ASSESSMENTS");

  const { searchParams } = new URL(req.url);
  const pointId = searchParams.get("pointId");
  const cycleId = searchParams.get("cycleId");
  const yearGroup = searchParams.get("yearGroup") || undefined;

  if (!pointId && !cycleId) {
    return NextResponse.json({ error: "pointId or cycleId is required" }, { status: 400 });
  }

  // Load assessments with results
  const assessments = await prisma.assessment.findMany({
    where: {
      tenantId: user.tenantId,
      ...(pointId ? { pointId } : {}),
      ...(cycleId ? { point: { cycleId } } : {}),
      ...(yearGroup ? { yearGroup } : {}),
    },
    include: {
      point: { select: { id: true, label: true, ordinal: true, assessedAt: true, cycleId: true } },
      results: {
        where: { tenantId: user.tenantId },
        select: {
          studentId: true,
          rawValue: true,
          normalizedScore: true,
          status: true,
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
    orderBy: [{ point: { ordinal: "asc" } }, { subject: "asc" }],
  });

  if (assessments.length === 0) {
    return NextResponse.json({ measures: [], assessments: [] });
  }

  // Detect dominant grade format
  const formatCounts = new Map<GradeFormat, number>();
  for (const a of assessments) {
    formatCounts.set(a.gradeFormat, (formatCounts.get(a.gradeFormat) ?? 0) + 1);
  }
  const dominantFormat = [...formatCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];

  // Build per-subject measures
  const subjectMap = new Map<string, typeof assessments>();
  for (const a of assessments) {
    const key = a.subject;
    if (!subjectMap.has(key)) subjectMap.set(key, []);
    subjectMap.get(key)!.push(a);
  }

  const subjectMeasures = [...subjectMap.entries()].map(([subject, subjectAssessments]) => {
    const latest = subjectAssessments[subjectAssessments.length - 1];
    const present = latest.results.filter((r) => r.status === "PRESENT");
    const total = latest.results.length;

    if (latest.gradeFormat === "GCSE") {
      return {
        subject,
        gradeFormat: "GCSE" as GradeFormat,
        pointLabel: latest.point.label,
        total,
        presentCount: present.length,
        thresholds: {
          "9+": gcseThresholdPct(latest.results, 9),
          "8+": gcseThresholdPct(latest.results, 8),
          "7+": gcseThresholdPct(latest.results, 7),
          "6+": gcseThresholdPct(latest.results, 6),
          "5+": gcseThresholdPct(latest.results, 5),
          "4+": gcseThresholdPct(latest.results, 4),
        },
        ppThreshold4: (() => {
          const pp = latest.results.filter((r) => r.student.ppFlag);
          const nonPp = latest.results.filter((r) => !r.student.ppFlag);
          return {
            pp: gcseThresholdPct(pp, 4),
            nonPp: gcseThresholdPct(nonPp, 4),
            gap: gcseThresholdPct(nonPp, 4) - gcseThresholdPct(pp, 4),
          };
        })(),
        ppThreshold5: (() => {
          const pp = latest.results.filter((r) => r.student.ppFlag);
          const nonPp = latest.results.filter((r) => !r.student.ppFlag);
          return {
            pp: gcseThresholdPct(pp, 5),
            nonPp: gcseThresholdPct(nonPp, 5),
            gap: gcseThresholdPct(nonPp, 5) - gcseThresholdPct(pp, 5),
          };
        })(),
        distribution: GCSE_THRESHOLDS.map((g) => ({
          grade: String(g),
          count: present.filter((r) => {
            if (r.normalizedScore === null) return false;
            return Math.round(r.normalizedScore * 9) === g;
          }).length,
        })),
      };
    } else {
      // A_LEVEL
      return {
        subject,
        gradeFormat: latest.gradeFormat as GradeFormat,
        pointLabel: latest.point.label,
        total,
        presentCount: present.length,
        thresholds: {
          "A*+": aLevelThresholdPct(latest.results, "A*"),
          "A+": aLevelThresholdPct(latest.results, "A"),
          "B+": aLevelThresholdPct(latest.results, "B"),
          "C+": aLevelThresholdPct(latest.results, "C"),
        },
        distribution: A_LEVEL_ORDER.map((g) => ({
          grade: g,
          count: present.filter((r) => r.rawValue.trim().toUpperCase() === g).length,
        })),
      };
    }
  });

  // GCSE "Basics" combined metric: English & Maths
  let gcseBasics: null | {
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
  } = null;

  const gcseAssessments = assessments.filter((a) => a.gradeFormat === "GCSE");
  if (gcseAssessments.length > 0) {
    // Get English and Maths latest assessments
    const engAssessments = assessments.filter(
      (a) =>
        a.gradeFormat === "GCSE" &&
        /english/i.test(a.subject) &&
        !/lit(erature)?$/i.test(a.subject)
    );
    const mathsAssessments = assessments.filter(
      (a) => a.gradeFormat === "GCSE" && /maths?/i.test(a.subject)
    );

    // Try to use "English Best" or "English Language" or first English assessment
    const engLatest = engAssessments[engAssessments.length - 1];
    const mathsLatest = mathsAssessments[mathsAssessments.length - 1];

    if (engLatest && mathsLatest) {
      // Build student → grade maps
      const engByStudent = new Map<string, typeof engLatest.results[0]>();
      for (const r of engLatest.results) engByStudent.set(r.studentId, r);
      const mathsByStudent = new Map<string, typeof mathsLatest.results[0]>();
      for (const r of mathsLatest.results) mathsByStudent.set(r.studentId, r);

      const allStudentIds = new Set([...engByStudent.keys(), ...mathsByStudent.keys()]);

      const studentResults = [...allStudentIds].map((sid) => {
        const eng = engByStudent.get(sid);
        const maths = mathsByStudent.get(sid);
        return { sid, eng, maths };
      });

      function bothAt(threshold: number): number {
        const eligible = studentResults.filter(
          (s) => s.eng?.status === "PRESENT" && s.maths?.status === "PRESENT"
        );
        if (eligible.length === 0) return 0;
        const passing = eligible.filter((s) => {
          const eg = s.eng!.normalizedScore !== null ? Math.round(s.eng!.normalizedScore * 9) : 0;
          const mg = s.maths!.normalizedScore !== null ? Math.round(s.maths!.normalizedScore * 9) : 0;
          return eg >= threshold && mg >= threshold;
        });
        return Math.round((passing.length / eligible.length) * 100);
      }

      function bothAtForGroup(
        studentIds: Set<string>,
        threshold: number
      ): number {
        const eligible = studentResults.filter(
          (s) =>
            studentIds.has(s.sid) &&
            s.eng?.status === "PRESENT" &&
            s.maths?.status === "PRESENT"
        );
        if (eligible.length === 0) return 0;
        const passing = eligible.filter((s) => {
          const eg = s.eng!.normalizedScore !== null ? Math.round(s.eng!.normalizedScore * 9) : 0;
          const mg = s.maths!.normalizedScore !== null ? Math.round(s.maths!.normalizedScore * 9) : 0;
          return eg >= threshold && mg >= threshold;
        });
        return Math.round((passing.length / eligible.length) * 100);
      }

      // Gather PP/SEND student IDs from English results (as proxy for all students)
      const ppStudentIds = new Set(
        engLatest.results.filter((r) => r.student.ppFlag).map((r) => r.studentId)
      );
      const nonPpStudentIds = new Set(
        engLatest.results.filter((r) => !r.student.ppFlag).map((r) => r.studentId)
      );
      const sendStudentIds = new Set(
        engLatest.results.filter((r) => r.student.sendFlag).map((r) => r.studentId)
      );
      const nonSendStudentIds = new Set(
        engLatest.results.filter((r) => !r.student.sendFlag).map((r) => r.studentId)
      );

      gcseBasics = {
        em4pct: bothAt(4),
        em5pct: bothAt(5),
        em7pct: bothAt(7),
        ppEm4: bothAtForGroup(ppStudentIds, 4),
        ppEm5: bothAtForGroup(ppStudentIds, 5),
        nonPpEm4: bothAtForGroup(nonPpStudentIds, 4),
        nonPpEm5: bothAtForGroup(nonPpStudentIds, 5),
        ppGap4: bothAtForGroup(nonPpStudentIds, 4) - bothAtForGroup(ppStudentIds, 4),
        ppGap5: bothAtForGroup(nonPpStudentIds, 5) - bothAtForGroup(ppStudentIds, 5),
        sendEm4: bothAtForGroup(sendStudentIds, 4),
        nonSendEm4: bothAtForGroup(nonSendStudentIds, 4),
        sendGap4: bothAtForGroup(nonSendStudentIds, 4) - bothAtForGroup(sendStudentIds, 4),
      };
    }
  }

  // A-Level overall summary across all subjects
  const aLevelAssessments = assessments.filter((a) => a.gradeFormat === "A_LEVEL");
  let aLevelSummary: null | {
    aStarPct: number;
    aPct: number;
    bPct: number;
    cPlusPct: number;
    totalEntries: number;
    avgGradeValue: number | null;
  } = null;

  if (aLevelAssessments.length > 0) {
    const allALevelResults = aLevelAssessments.flatMap((a) =>
      a.results.filter((r) => r.status === "PRESENT")
    );
    const totalEntries = allALevelResults.length;

    if (totalEntries > 0) {
      const aStarCount = allALevelResults.filter(
        (r) => r.rawValue.trim().toUpperCase() === "A*"
      ).length;
      const aOrAbove = allALevelResults.filter((r) => {
        const s = A_LEVEL_SCORE[r.rawValue.trim().toUpperCase()];
        return s !== undefined && s >= 6;
      }).length;
      const bOrAbove = allALevelResults.filter((r) => {
        const s = A_LEVEL_SCORE[r.rawValue.trim().toUpperCase()];
        return s !== undefined && s >= 5;
      }).length;
      const cOrAbove = allALevelResults.filter((r) => {
        const s = A_LEVEL_SCORE[r.rawValue.trim().toUpperCase()];
        return s !== undefined && s >= 4;
      }).length;

      const scoreSum = allALevelResults.reduce((sum, r) => {
        const s = A_LEVEL_SCORE[r.rawValue.trim().toUpperCase()];
        return sum + (s ?? 0);
      }, 0);

      aLevelSummary = {
        aStarPct: Math.round((aStarCount / totalEntries) * 100),
        aPct: Math.round((aOrAbove / totalEntries) * 100),
        bPct: Math.round((bOrAbove / totalEntries) * 100),
        cPlusPct: Math.round((cOrAbove / totalEntries) * 100),
        totalEntries,
        avgGradeValue: scoreSum / totalEntries,
      };
    }
  }

  // Summary stats
  const totalStudents = new Set(
    assessments.flatMap((a) => a.results.map((r) => r.studentId))
  ).size;
  const totalResults = assessments.reduce((sum, a) => sum + a.results.length, 0);

  return NextResponse.json({
    dominantFormat,
    totalStudents,
    totalResults,
    subjectMeasures,
    gcseBasics,
    aLevelSummary,
    assessments: assessments.map((a) => ({
      id: a.id,
      subject: a.subject,
      yearGroup: a.yearGroup,
      gradeFormat: a.gradeFormat,
      pointLabel: a.point.label,
      pointOrdinal: a.point.ordinal,
      resultCount: a.results.length,
    })),
  });
}
