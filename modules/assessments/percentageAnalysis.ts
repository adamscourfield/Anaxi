/**
 * Percentage & Raw Score Analysis
 *
 * Attainment analysis for PERCENTAGE and RAW format assessments.
 * Unlike GCSE/A-Level, these formats have no fixed grade boundaries, so the
 * analysis centres on:
 *
 *   1. Score distribution across the cohort (10% bands)
 *   2. Subject-level means with PP/SEND gap
 *   3. Class (teacher) comparison — which groups are above/below the year mean
 *   4. Overall rank leaderboard (top 10 / bottom 10)
 *
 * For comparison between two points:
 *   5. Rank movement — who moved significantly up or down
 *   6. Teaching group shift — which classes improved/declined most
 */

import { prisma } from "@/lib/prisma";
import { competitionRank } from "./ranking";

// ─── Stat helpers ─────────────────────────────────────────────────────────────

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type BandCount = {
  band: string;
  from: number;
  to: number;
  count: number;
  pct: number;
};

export type TeachingGroupStat = {
  group: string;
  count: number;
  mean: number;
  /** Difference from the year-group mean for this subject (pp). Positive = above average. */
  vsYearMean: number;
};

export type PercentageStudentResult = {
  studentId: string;
  name: string;
  ppFlag: boolean;
  sendFlag: boolean;
  score: number; // 0–100
  rank: number;
};

export type SubjectStat = {
  subject: string;
  assessmentId: string;
  presentCount: number;
  mean: number; // 0–100
  median: number;
  q1: number; // 25th percentile
  q3: number; // 75th percentile
  /** PP mean (0–100), null when no PP students present */
  ppMean: number | null;
  nonPpMean: number | null;
  /** nonPpMean − ppMean. Positive = PP underperforming relative to peers. */
  ppGap: number | null;
  sendMean: number | null;
  nonSendMean: number | null;
  /** Breakdown by subject teacher. Empty when teacher assignments are not set up. */
  teachingGroups: TeachingGroupStat[];
  /** Top 10 students by score in this subject */
  topStudents: PercentageStudentResult[];
  /** Bottom 10 students by score in this subject */
  bottomStudents: PercentageStudentResult[];
};

export type OverallRankEntry = {
  studentId: string;
  name: string;
  ppFlag: boolean;
  sendFlag: boolean;
  /** Mean % across all subjects this student sat */
  overallMean: number;
  rank: number;
  subjectCount: number;
};

export type PercentagePointSummary = {
  pointId: string;
  gradeFormat: string;
  /** Mean % across all subject means */
  yearMean: number;
  /** Score distribution across ALL results in 10% bands */
  distribution: BandCount[];
  subjects: SubjectStat[];
  /** Top 10 students by overall mean */
  overallTop: OverallRankEntry[];
  /** Bottom 10 students by overall mean */
  overallBottom: OverallRankEntry[];
};

// ─── Single-point summary ─────────────────────────────────────────────────────

export async function computePercentageSummary(
  tenantId: string,
  pointId: string,
  yearGroup?: string
): Promise<PercentagePointSummary | null> {
  const assessments = await prisma.assessment.findMany({
    where: {
      tenantId,
      pointId,
      gradeFormat: { in: ["PERCENTAGE", "RAW"] },
      ...(yearGroup ? { yearGroup } : {}),
    },
    include: {
      results: {
        where: { tenantId },
        include: {
          student: {
            select: { fullName: true, ppFlag: true, sendFlag: true },
          },
        },
      },
    },
    orderBy: { subject: "asc" },
  });

  if (assessments.length === 0) return null;

  // Fetch teacher assignments per assessment (separate query to avoid cartesian join)
  const teachersByAssessment = new Map<
    string,
    Map<string, string> // studentId → teacher name
  >();

  await Promise.all(
    assessments.map(async (a) => {
      const rows = await prisma.assessmentResult.findMany({
        where: { tenantId, assessmentId: a.id, status: "PRESENT" },
        select: {
          studentId: true,
          student: {
            select: {
              subjectTeachers: {
                where: {
                  tenantId,
                  subject: { name: a.subject },
                  effectiveTo: null,
                },
                select: { teacher: { select: { fullName: true } } },
                take: 1,
              },
            },
          },
        },
      });
      const map = new Map<string, string>();
      for (const r of rows) {
        map.set(r.studentId, r.student.subjectTeachers[0]?.teacher?.fullName ?? "Unassigned");
      }
      teachersByAssessment.set(a.id, map);
    })
  );

  // ── Per-subject stats ────────────────────────────────────────────────────────
  const subjectStats: SubjectStat[] = assessments.map((a) => {
    const present = a.results.filter(
      (r) => r.status === "PRESENT" && r.normalizedScore !== null
    );
    const scores = present.map((r) => round1(r.normalizedScore! * 100));
    const sorted = [...scores].sort((x, y) => x - y);

    const subjectMean = avg(scores) ?? 0;

    // PP/SEND groups
    const ppScores = present.filter((r) => r.student.ppFlag).map((r) => round1(r.normalizedScore! * 100));
    const nonPpScores = present.filter((r) => !r.student.ppFlag).map((r) => round1(r.normalizedScore! * 100));
    const sendScores = present.filter((r) => r.student.sendFlag).map((r) => round1(r.normalizedScore! * 100));
    const nonSendScores = present.filter((r) => !r.student.sendFlag).map((r) => round1(r.normalizedScore! * 100));

    const ppMean = avg(ppScores);
    const nonPpMean = avg(nonPpScores);
    const sendMean = avg(sendScores);
    const nonSendMean = avg(nonSendScores);

    // Teaching groups
    const teacherMap = teachersByAssessment.get(a.id) ?? new Map();
    const groupScores = new Map<string, number[]>();
    for (const r of present) {
      const group = teacherMap.get(r.studentId) ?? "Unassigned";
      const list = groupScores.get(group) ?? [];
      list.push(round1(r.normalizedScore! * 100));
      groupScores.set(group, list);
    }
    const teachingGroups: TeachingGroupStat[] = [...groupScores.entries()]
      .map(([group, gs]) => ({
        group,
        count: gs.length,
        mean: round1(avg(gs) ?? 0),
        vsYearMean: round1((avg(gs) ?? 0) - subjectMean),
      }))
      .sort((x, y) => y.mean - x.mean);

    // Rank students within this subject
    const studentRanks = competitionRank(scores);
    const ranked: PercentageStudentResult[] = present.map((r, i) => ({
      studentId: r.studentId,
      name: r.student.fullName,
      ppFlag: r.student.ppFlag,
      sendFlag: r.student.sendFlag,
      score: round1(r.normalizedScore! * 100),
      rank: studentRanks[i] ?? present.length,
    }));

    // Top 10 / bottom 10 by score
    const sortedRanked = [...ranked].sort((x, y) => y.score - x.score);
    const topStudents = sortedRanked.slice(0, 10);
    const bottomStudents = [...sortedRanked].reverse().slice(0, 10);

    return {
      subject: a.subject,
      assessmentId: a.id,
      presentCount: present.length,
      mean: round1(subjectMean),
      median: round1(median(sorted)),
      q1: round1(percentile(sorted, 25)),
      q3: round1(percentile(sorted, 75)),
      ppMean: ppMean !== null ? round1(ppMean) : null,
      nonPpMean: nonPpMean !== null ? round1(nonPpMean) : null,
      ppGap:
        ppMean !== null && nonPpMean !== null ? round1(nonPpMean - ppMean) : null,
      sendMean: sendMean !== null ? round1(sendMean) : null,
      nonSendMean: nonSendMean !== null ? round1(nonSendMean) : null,
      teachingGroups: teachingGroups.filter((g) => g.group !== "Unassigned" || teachingGroups.length === 1),
      topStudents,
      bottomStudents,
    };
  });

  // ── Overall student ranking (mean across subjects) ────────────────────────
  const studentAccum = new Map<
    string,
    { name: string; ppFlag: boolean; sendFlag: boolean; scores: number[] }
  >();
  for (const a of assessments) {
    for (const r of a.results) {
      if (r.status !== "PRESENT" || r.normalizedScore === null) continue;
      const entry = studentAccum.get(r.studentId) ?? {
        name: r.student.fullName,
        ppFlag: r.student.ppFlag,
        sendFlag: r.student.sendFlag,
        scores: [],
      };
      entry.scores.push(r.normalizedScore * 100);
      studentAccum.set(r.studentId, entry);
    }
  }

  const studentList = [...studentAccum.entries()].map(([sid, d]) => ({
    studentId: sid,
    name: d.name,
    ppFlag: d.ppFlag,
    sendFlag: d.sendFlag,
    overallMean: round1(avg(d.scores) ?? 0),
    subjectCount: d.scores.length,
  }));

  const overallScores = studentList.map((s) => s.overallMean);
  const overallRanks = competitionRank(overallScores);

  const leaderboard: OverallRankEntry[] = studentList
    .map((s, i) => ({ ...s, rank: overallRanks[i] ?? studentList.length }))
    .sort((a, b) => a.rank - b.rank);

  // ── Year mean (mean of subject means) ────────────────────────────────────
  const yearMean = round1(avg(subjectStats.map((s) => s.mean)) ?? 0);

  // ── Distribution in 10% bands across all results ─────────────────────────
  const allScores = assessments.flatMap((a) =>
    a.results
      .filter((r) => r.status === "PRESENT" && r.normalizedScore !== null)
      .map((r) => r.normalizedScore! * 100)
  );
  const EDGES = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  const distribution: BandCount[] = EDGES.slice(0, -1).map((from, i) => {
    const to = EDGES[i + 1];
    const isLast = i === EDGES.length - 2;
    const count = allScores.filter((s) => s >= from && (isLast ? s <= to : s < to)).length;
    return {
      band: `${from}–${to}%`,
      from,
      to,
      count,
      pct: allScores.length > 0 ? round1((count / allScores.length) * 100) : 0,
    };
  });

  return {
    pointId,
    gradeFormat: assessments[0].gradeFormat,
    yearMean,
    distribution,
    subjects: subjectStats,
    overallTop: leaderboard.slice(0, 10),
    overallBottom: leaderboard.slice(-10).reverse(),
  };
}

// ─── Rank movement (comparison view) ─────────────────────────────────────────

export type RankMovementEntry = {
  studentId: string;
  name: string;
  ppFlag: boolean;
  sendFlag: boolean;
  fromRank: number | null;
  toRank: number | null;
  /** Positive = moved up (rank number fell). Negative = moved down. */
  rankChange: number | null;
  fromMean: number | null;
  toMean: number | null;
  /** toMean − fromMean in pp */
  meanChange: number | null;
};

export type TeachingGroupShift = {
  subject: string;
  groups: Array<{
    group: string;
    fromMean: number | null;
    toMean: number | null;
    delta: number | null;
  }>;
};

export type RankMovementSummary = {
  rankMovements: RankMovementEntry[];
  /** Only includes subjects where multiple teaching groups are assigned */
  teachingGroupShifts: TeachingGroupShift[];
};

export async function computeRankMovement(
  tenantId: string,
  fromPointId: string,
  toPointId: string,
  yearGroup?: string
): Promise<RankMovementSummary | null> {
  const filter = {
    gradeFormat: { in: ["PERCENTAGE" as const, "RAW" as const] },
    ...(yearGroup ? { yearGroup } : {}),
  };

  const [fromAssessments, toAssessments] = await Promise.all([
    prisma.assessment.findMany({
      where: { tenantId, pointId: fromPointId, ...filter },
      include: {
        results: {
          where: { tenantId },
          include: { student: { select: { fullName: true, ppFlag: true, sendFlag: true } } },
        },
      },
    }),
    prisma.assessment.findMany({
      where: { tenantId, pointId: toPointId, ...filter },
      include: {
        results: {
          where: { tenantId },
          include: { student: { select: { fullName: true, ppFlag: true, sendFlag: true } } },
        },
      },
    }),
  ]);

  if (fromAssessments.length === 0 && toAssessments.length === 0) return null;

  // Build per-student overall means at each point
  function buildMeans(
    assessments: typeof fromAssessments
  ): Map<string, { name: string; ppFlag: boolean; sendFlag: boolean; mean: number }> {
    const accum = new Map<
      string,
      { name: string; ppFlag: boolean; sendFlag: boolean; scores: number[] }
    >();
    for (const a of assessments) {
      for (const r of a.results) {
        if (r.status !== "PRESENT" || r.normalizedScore === null) continue;
        const entry = accum.get(r.studentId) ?? {
          name: r.student.fullName,
          ppFlag: r.student.ppFlag,
          sendFlag: r.student.sendFlag,
          scores: [],
        };
        entry.scores.push(r.normalizedScore * 100);
        accum.set(r.studentId, entry);
      }
    }
    const result = new Map<string, { name: string; ppFlag: boolean; sendFlag: boolean; mean: number }>();
    for (const [sid, d] of accum.entries()) {
      result.set(sid, { name: d.name, ppFlag: d.ppFlag, sendFlag: d.sendFlag, mean: round1(avg(d.scores) ?? 0) });
    }
    return result;
  }

  const fromMeans = buildMeans(fromAssessments);
  const toMeans = buildMeans(toAssessments);

  // Compute competition ranks within each point
  const fromStudentList = [...fromMeans.entries()];
  const toStudentList = [...toMeans.entries()];
  const fromRanks = competitionRank(fromStudentList.map(([, d]) => d.mean));
  const toRanks = competitionRank(toStudentList.map(([, d]) => d.mean));

  const fromRankMap = new Map(
    fromStudentList.map(([sid, d], i) => [sid, { rank: fromRanks[i], ...d }])
  );
  const toRankMap = new Map(
    toStudentList.map(([sid, d], i) => [sid, { rank: toRanks[i], ...d }])
  );

  const allIds = new Set([...fromRankMap.keys(), ...toRankMap.keys()]);
  const rankMovements: RankMovementEntry[] = [...allIds]
    .map((sid) => {
      const from = fromRankMap.get(sid);
      const to = toRankMap.get(sid);
      const fromRank = from?.rank ?? null;
      const toRank = to?.rank ?? null;
      return {
        studentId: sid,
        name: (from ?? to)!.name,
        ppFlag: (from ?? to)!.ppFlag,
        sendFlag: (from ?? to)!.sendFlag,
        fromRank,
        toRank,
        // Positive = moved up (rank number decreased)
        rankChange: fromRank !== null && toRank !== null ? fromRank - toRank : null,
        fromMean: from?.mean ?? null,
        toMean: to?.mean ?? null,
        meanChange:
          from?.mean !== undefined && to?.mean !== undefined
            ? round1(to.mean - from.mean)
            : null,
      };
    })
    .sort((a, b) => (b.rankChange ?? 0) - (a.rankChange ?? 0));

  // ── Teaching group shifts per subject ────────────────────────────────────
  const subjects = [
    ...new Set([
      ...fromAssessments.map((a) => a.subject),
      ...toAssessments.map((a) => a.subject),
    ]),
  ].sort();

  const teachingGroupShifts: TeachingGroupShift[] = [];

  await Promise.all(
    subjects.map(async (subject) => {
      const fromA = fromAssessments.find((a) => a.subject === subject);
      const toA = toAssessments.find((a) => a.subject === subject);

      const [fromRows, toRows] = await Promise.all([
        fromA
          ? prisma.assessmentResult.findMany({
              where: { tenantId, assessmentId: fromA.id, status: "PRESENT" },
              select: {
                normalizedScore: true,
                student: {
                  select: {
                    subjectTeachers: {
                      where: { tenantId, subject: { name: subject }, effectiveTo: null },
                      select: { teacher: { select: { fullName: true } } },
                      take: 1,
                    },
                  },
                },
              },
            })
          : [],
        toA
          ? prisma.assessmentResult.findMany({
              where: { tenantId, assessmentId: toA.id, status: "PRESENT" },
              select: {
                normalizedScore: true,
                student: {
                  select: {
                    subjectTeachers: {
                      where: { tenantId, subject: { name: subject }, effectiveTo: null },
                      select: { teacher: { select: { fullName: true } } },
                      take: 1,
                    },
                  },
                },
              },
            })
          : [],
      ]);

      const fromGroupMap = new Map<string, number[]>();
      const toGroupMap = new Map<string, number[]>();

      for (const r of fromRows) {
        if (r.normalizedScore === null) continue;
        const g = r.student.subjectTeachers[0]?.teacher?.fullName ?? "Unassigned";
        const list = fromGroupMap.get(g) ?? [];
        list.push(r.normalizedScore * 100);
        fromGroupMap.set(g, list);
      }
      for (const r of toRows) {
        if (r.normalizedScore === null) continue;
        const g = r.student.subjectTeachers[0]?.teacher?.fullName ?? "Unassigned";
        const list = toGroupMap.get(g) ?? [];
        list.push(r.normalizedScore * 100);
        toGroupMap.set(g, list);
      }

      const allGroups = new Set([...fromGroupMap.keys(), ...toGroupMap.keys()]);
      // Skip if only one group (or all unassigned) — no comparison to make
      const namedGroups = [...allGroups].filter((g) => g !== "Unassigned");
      if (namedGroups.length < 2) return;

      teachingGroupShifts.push({
        subject,
        groups: [...allGroups]
          .map((g) => {
            const f = avg(fromGroupMap.get(g) ?? []);
            const t = avg(toGroupMap.get(g) ?? []);
            return {
              group: g,
              fromMean: f !== null ? round1(f) : null,
              toMean: t !== null ? round1(t) : null,
              delta: f !== null && t !== null ? round1(t - f) : null,
            };
          })
          .sort((a, b) => (b.toMean ?? 0) - (a.toMean ?? 0)),
      });
    })
  );

  return { rankMovements, teachingGroupShifts };
}
