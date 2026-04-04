/**
 * GET /api/assessments/metrics
 *
 * Single-point attainment metrics for a result point.
 * Returns GCSE or A-Level key measures depending on dominant grade format.
 *
 * Query params:
 *   pointId    — required
 *   yearGroup  — optional filter
 */

import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import type { GradeFormat } from "@prisma/client";

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
  const above = present.filter((r) => {
    if (r.normalizedScore === null) return false;
    return Math.round(r.normalizedScore * 9) >= threshold;
  });
  return Math.round((above.length / present.length) * 100);
}

function aLevelThresholdPct(
  results: Array<{ rawValue: string; status: string }>,
  minGrade: string
): number {
  const present = results.filter((r) => r.status === "PRESENT");
  if (present.length === 0) return 0;
  const minScore = A_LEVEL_SCORE[minGrade] ?? 0;
  const above = present.filter((r) => {
    const s = A_LEVEL_SCORE[r.rawValue.trim().toUpperCase()];
    return s !== undefined && s >= minScore;
  });
  return Math.round((above.length / present.length) * 100);
}

export async function GET(req: Request) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ASSESSMENTS");

  const { searchParams } = new URL(req.url);
  const pointId = searchParams.get("pointId");
  const yearGroup = searchParams.get("yearGroup") || undefined;

  if (!pointId) {
    return NextResponse.json({ error: "pointId is required" }, { status: 400 });
  }

  const assessments = await prisma.assessment.findMany({
    where: {
      tenantId: user.tenantId,
      pointId,
      ...(yearGroup ? { yearGroup } : {}),
    },
    include: {
      point: {
        select: { id: true, label: true, ordinal: true, pointType: true, isFinalPoint: true },
      },
      results: {
        where: { tenantId: user.tenantId },
        select: {
          studentId: true,
          rawValue: true,
          normalizedScore: true,
          status: true,
          student: {
            select: { fullName: true, ppFlag: true, sendFlag: true, yearGroup: true },
          },
        },
      },
    },
    orderBy: { subject: "asc" },
  });

  if (assessments.length === 0) {
    return NextResponse.json({ subjects: [], gcseBasics: null, aLevelSummary: null });
  }

  // Dominant format
  const formatCounts = new Map<GradeFormat, number>();
  for (const a of assessments) {
    formatCounts.set(a.gradeFormat, (formatCounts.get(a.gradeFormat) ?? 0) + 1);
  }
  const dominantFormat = [...formatCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];

  const subjectMeasures = assessments.map((a) => {
    const present = a.results.filter((r) => r.status === "PRESENT");
    const total = a.results.length;

    const ppResults = a.results.filter((r) => r.student.ppFlag);
    const nonPpResults = a.results.filter((r) => !r.student.ppFlag);
    const sendResults = a.results.filter((r) => r.student.sendFlag);
    const nonSendResults = a.results.filter((r) => !r.student.sendFlag);

    if (a.gradeFormat === "GCSE") {
      const dist = [9, 8, 7, 6, 5, 4, 3, 2, 1].map((g) => ({
        grade: String(g),
        count: present.filter((r) => r.normalizedScore !== null && Math.round(r.normalizedScore * 9) === g).length,
      }));
      return {
        subject: a.subject,
        assessmentId: a.id,
        gradeFormat: a.gradeFormat as GradeFormat,
        total,
        presentCount: present.length,
        thresholds: {
          "9+": gcseThresholdPct(a.results, 9),
          "7+": gcseThresholdPct(a.results, 7),
          "5+": gcseThresholdPct(a.results, 5),
          "4+": gcseThresholdPct(a.results, 4),
        },
        pp: {
          count: ppResults.filter((r) => r.status === "PRESENT").length,
          t4: gcseThresholdPct(ppResults, 4),
          t5: gcseThresholdPct(ppResults, 5),
          nonPpT4: gcseThresholdPct(nonPpResults, 4),
          nonPpT5: gcseThresholdPct(nonPpResults, 5),
          gap4: gcseThresholdPct(nonPpResults, 4) - gcseThresholdPct(ppResults, 4),
          gap5: gcseThresholdPct(nonPpResults, 5) - gcseThresholdPct(ppResults, 5),
        },
        send: {
          count: sendResults.filter((r) => r.status === "PRESENT").length,
          t4: gcseThresholdPct(sendResults, 4),
          t5: gcseThresholdPct(sendResults, 5),
          nonSendT4: gcseThresholdPct(nonSendResults, 4),
          nonSendT5: gcseThresholdPct(nonSendResults, 5),
          gap4: gcseThresholdPct(nonSendResults, 4) - gcseThresholdPct(sendResults, 4),
          gap5: gcseThresholdPct(nonSendResults, 5) - gcseThresholdPct(sendResults, 5),
        },
        distribution: dist,
        students: present.map((r) => ({
          studentId: r.studentId,
          name: r.student.fullName,
          score: r.normalizedScore,
          rawValue: r.rawValue,
        })),
      };
    } else {
      const dist = A_LEVEL_ORDER.map((g) => ({
        grade: g,
        count: present.filter((r) => r.rawValue.trim().toUpperCase() === g).length,
      }));
      return {
        subject: a.subject,
        assessmentId: a.id,
        gradeFormat: a.gradeFormat as GradeFormat,
        total,
        presentCount: present.length,
        thresholds: {
          "A*": aLevelThresholdPct(a.results, "A*"),
          "A+": aLevelThresholdPct(a.results, "A"),
          "B+": aLevelThresholdPct(a.results, "B"),
          "C+": aLevelThresholdPct(a.results, "C"),
        },
        pp: null,
        send: null,
        distribution: dist,
        students: present.map((r) => ({
          studentId: r.studentId,
          name: r.student.fullName,
          score: null,
          rawValue: r.rawValue,
        })),
      };
    }
  });

  // GCSE Basics (English + Maths combined)
  let gcseBasics = null;
  if (dominantFormat === "GCSE") {
    const engA = assessments.find((a) => a.gradeFormat === "GCSE" && /english/i.test(a.subject) && !/lit/i.test(a.subject));
    const mathsA = assessments.find((a) => a.gradeFormat === "GCSE" && /maths?/i.test(a.subject));
    if (engA && mathsA) {
      const engMap = new Map(engA.results.map((r) => [r.studentId, r]));
      const mathsMap = new Map(mathsA.results.map((r) => [r.studentId, r]));
      const allIds = [...new Set([...engMap.keys(), ...mathsMap.keys()])];

      const bothPresent = allIds.filter(
        (id) => engMap.get(id)?.status === "PRESENT" && mathsMap.get(id)?.status === "PRESENT"
      );

      function bothAt(t: number) {
        if (bothPresent.length === 0) return 0;
        const p = bothPresent.filter((id) => {
          const eg = engMap.get(id)!.normalizedScore;
          const mg = mathsMap.get(id)!.normalizedScore;
          return eg !== null && mg !== null && Math.round(eg * 9) >= t && Math.round(mg * 9) >= t;
        });
        return Math.round((p.length / bothPresent.length) * 100);
      }

      const ppIds = new Set(engA.results.filter((r) => r.student.ppFlag).map((r) => r.studentId));
      const nonPpIds = new Set(engA.results.filter((r) => !r.student.ppFlag).map((r) => r.studentId));
      const sendIds = new Set(engA.results.filter((r) => r.student.sendFlag).map((r) => r.studentId));
      const nonSendIds = new Set(engA.results.filter((r) => !r.student.sendFlag).map((r) => r.studentId));

      function bothAtGroup(ids: Set<string>, t: number) {
        const eligible = bothPresent.filter((id) => ids.has(id));
        if (eligible.length === 0) return 0;
        const p = eligible.filter((id) => {
          const eg = engMap.get(id)?.normalizedScore;
          const mg = mathsMap.get(id)?.normalizedScore;
          return eg !== null && mg !== null && Math.round(eg! * 9) >= t && Math.round(mg! * 9) >= t;
        });
        return Math.round((p.length / eligible.length) * 100);
      }

      function getAtTarget(t: number) {
        return bothPresent.map(id => {
          const eg = engMap.get(id)!.normalizedScore;
          const mg = mathsMap.get(id)!.normalizedScore;
          const eRaw = engMap.get(id)!.rawValue;
          const mRaw = mathsMap.get(id)!.rawValue;
          return {
            studentId: id,
            name: engMap.get(id)!.student.fullName,
            engScore: eg,
            mathScore: mg,
            engRaw: eRaw,
            mathRaw: mRaw,
            met: (eg !== null && Math.round(eg * 9) >= t && mg !== null && Math.round(mg * 9) >= t)
          };
        });
      }

      gcseBasics = {
        em4: bothAt(4),
        em5: bothAt(5),
        em7: bothAt(7),
        ppEm4: bothAtGroup(ppIds, 4),
        ppEm5: bothAtGroup(ppIds, 5),
        nonPpEm4: bothAtGroup(nonPpIds, 4),
        nonPpEm5: bothAtGroup(nonPpIds, 5),
        gap4: bothAtGroup(nonPpIds, 4) - bothAtGroup(ppIds, 4),
        gap5: bothAtGroup(nonPpIds, 5) - bothAtGroup(ppIds, 5),
        sendEm4: bothAtGroup(sendIds, 4),
        nonSendEm4: bothAtGroup(nonSendIds, 4),
        sendGap4: bothAtGroup(nonSendIds, 4) - bothAtGroup(sendIds, 4),
        students4: getAtTarget(4),
        students5: getAtTarget(5),
        students7: getAtTarget(7),
      };
    }
  }

  // A-Level overall summary
  let aLevelSummary = null;
  if (dominantFormat === "A_LEVEL") {
    const allResults = assessments.flatMap((a) => a.results.filter((r) => r.status === "PRESENT"));
    if (allResults.length > 0) {
      const total = allResults.length;
      aLevelSummary = {
        total,
        aStarPct: Math.round((allResults.filter((r) => r.rawValue.trim().toUpperCase() === "A*").length / total) * 100),
        aPct: Math.round((allResults.filter((r) => (A_LEVEL_SCORE[r.rawValue.trim().toUpperCase()] ?? 0) >= 6).length / total) * 100),
        bPct: Math.round((allResults.filter((r) => (A_LEVEL_SCORE[r.rawValue.trim().toUpperCase()] ?? 0) >= 5).length / total) * 100),
        cPlusPct: Math.round((allResults.filter((r) => (A_LEVEL_SCORE[r.rawValue.trim().toUpperCase()] ?? 0) >= 4).length / total) * 100),
      };
    }
  }

  return NextResponse.json({
    dominantFormat,
    totalStudents: new Set(assessments.flatMap((a) => a.results.map((r) => r.studentId))).size,
    totalEntries: assessments.reduce((s, a) => s + a.results.length, 0),
    subjects: subjectMeasures,
    gcseBasics,
    aLevelSummary,
  });
}
