/**
 * Assessment Analysis — Phase 2A
 *
 * Per-student, per-teacher, and cohort attainment with movement, value-add,
 * group gaps (SEND / PP / prior attainment), and cross-subject outlier
 * detection. All comparisons use normalizedScore (0–1) as the common currency
 * regardless of grade format.
 */

import { prisma } from "@/lib/prisma";

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIOR_LOW_THRESHOLD = 95;
const PRIOR_HIGH_THRESHOLD = 105;
const OUTLIER_Z_THRESHOLD = 1.0;
const MOVEMENT_STABLE_BAND = 0.02;
const MIN_GROUP_SIZE = 3;
const ELIGIBLE_RESULT_STATUSES = ["VALIDATED", "PUBLISHED", "LOCKED"];

// ─── Types ────────────────────────────────────────────────────────────────────

export type PriorBand = "LOW" | "MID" | "HIGH" | "UNKNOWN";
export type MovementLabel = "IMPROVING" | "DECLINING" | "STABLE" | "NO_PRIOR";

export type SubjectOutlier = {
  subject: string;
  normalizedScore: number;
  studentMean: number;
  zScore: number;
  direction: "UNDER" | "OVER";
};

export type AssessmentSubjectResult = {
  cycleId: string;
  cycleLabel: string;
  pointLabel: string;
  subject: string;
  yearGroup: string;
  assessmentTitle: string;
  gradeFormat: string;
  rawValue: string;
  normalizedScore: number | null;
  normalisedGrade: string | null;
  movement: number | null;
  movementLabel: MovementLabel;
  priorNormalizedScore: number | null;
};

export type AssessmentStudentRow = {
  studentId: string;
  studentName: string;
  yearGroup: string | null;
  sendFlag: boolean;
  ppFlag: boolean;
  priorBand: PriorBand;
  ks2MathsScaledScore: number | null;
  ks2ReadingScaledScore: number | null;
  subjects: AssessmentSubjectResult[];
  overallMean: number | null;
  outliers: SubjectOutlier[];
};

export type AssessmentTeacherSubjectRow = {
  subject: string;
  yearGroup: string;
  studentCount: number;
  meanNormalizedScore: number | null;
  movement: number | null;
  valueAdd: number | null;
  sendMean: number | null;
  nonSendMean: number | null;
  sendGap: number | null;
  ppMean: number | null;
  nonPpMean: number | null;
  ppGap: number | null;
  decliningCount: number;
  stableCount: number;
  improvingCount: number;
};

export type AssessmentTeacherRow = {
  teacherId: string;
  teacherName: string;
  departmentNames: string[];
  subjects: AssessmentTeacherSubjectRow[];
  overallMean: number | null;
  overallValueAdd: number | null;
};

export type AssessmentCohortRow = {
  yearGroup: string;
  subject: string;
  studentCount: number;
  meanNormalizedScore: number | null;
  movement: number | null;
  lowPriorMean: number | null;
  midPriorMean: number | null;
  highPriorMean: number | null;
  sendMean: number | null;
  nonSendMean: number | null;
  sendGap: number | null;
  ppMean: number | null;
  nonPpMean: number | null;
  ppGap: number | null;
  decliningCount: number;
  stableCount: number;
  improvingCount: number;
};

export type ActiveCycleMeta = {
  cycleId: string;
  cycleLabel: string;
  qualificationType: string;
  currentPointLabel: string;
  previousPointLabel: string | null;
};

export type AssessmentAnalysisResult = {
  students: AssessmentStudentRow[];
  teachers: AssessmentTeacherRow[];
  cohorts: AssessmentCohortRow[];
  cycles: ActiveCycleMeta[];
  computedAt: Date;
};

export type AssessmentAnalysisOptions = {
  cycleId?: string;
};

// ─── Pure helpers (exported for testing) ─────────────────────────────────────

export function getPriorBand(
  ks2Maths: number | null,
  ks2Reading: number | null,
): PriorBand {
  const scores = [ks2Maths, ks2Reading].filter((s): s is number => s !== null);
  if (scores.length === 0) return "UNKNOWN";
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  if (avg < PRIOR_LOW_THRESHOLD) return "LOW";
  if (avg <= PRIOR_HIGH_THRESHOLD) return "MID";
  return "HIGH";
}

export function getMovementLabel(movement: number | null): MovementLabel {
  if (movement === null) return "NO_PRIOR";
  if (movement > MOVEMENT_STABLE_BAND) return "IMPROVING";
  if (movement < -MOVEMENT_STABLE_BAND) return "DECLINING";
  return "STABLE";
}

export function computeOutliers(
  subjectScores: Array<{ subject: string; normalizedScore: number }>,
): SubjectOutlier[] {
  if (subjectScores.length < 2) return [];
  const scores = subjectScores.map((s) => s.normalizedScore);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance =
    scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;
  const stdDev = Math.sqrt(variance);
  if (stdDev < 0.01) return [];
  return subjectScores
    .map(({ subject, normalizedScore }) => {
      const zScore = (normalizedScore - mean) / stdDev;
      return {
        subject,
        normalizedScore,
        studentMean: mean,
        zScore,
        direction: zScore < 0 ? ("UNDER" as const) : ("OVER" as const),
      };
    })
    .filter((o) => Math.abs(o.zScore) >= OUTLIER_Z_THRESHOLD);
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function computeMean(scores: number[]): number | null {
  if (scores.length === 0) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

function groupMean(
  rows: Array<{ normalizedScore: number | null }>,
  minCount = MIN_GROUP_SIZE,
): number | null {
  const scores = rows
    .map((r) => r.normalizedScore)
    .filter((s): s is number => s !== null);
  if (scores.length < minCount) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

function computeGap(
  nonFlagMean: number | null,
  flagMean: number | null,
): number | null {
  if (nonFlagMean === null || flagMean === null) return null;
  return nonFlagMean - flagMean;
}

type BandAverageMap = Record<PriorBand, number | null>;

function computeBandAverages(
  entries: Array<{ normalizedScore: number | null; priorBand: PriorBand }>,
): BandAverageMap {
  const bands: PriorBand[] = ["LOW", "MID", "HIGH", "UNKNOWN"];
  const result = {} as BandAverageMap;
  for (const band of bands) {
    const scores = entries
      .filter((e) => e.priorBand === band && e.normalizedScore !== null)
      .map((e) => e.normalizedScore!);
    result[band] =
      scores.length >= MIN_GROUP_SIZE
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : null;
  }
  return result;
}

function computeValueAdd(
  actualMean: number | null,
  cohortBands: Array<{ priorBand: PriorBand; normalizedScore: number | null }>,
  bandAverages: BandAverageMap,
): number | null {
  if (actualMean === null) return null;
  const expectations = cohortBands
    .map((s) => bandAverages[s.priorBand])
    .filter((e): e is number => e !== null);
  if (expectations.length < MIN_GROUP_SIZE) return null;
  const expectedMean =
    expectations.reduce((a, b) => a + b, 0) / expectations.length;
  return actualMean - expectedMean;
}

type MovementCounts = {
  decliningCount: number;
  stableCount: number;
  improvingCount: number;
};

function countMovements(
  movements: Array<number | null>,
): MovementCounts {
  let decliningCount = 0;
  let stableCount = 0;
  let improvingCount = 0;
  for (const m of movements) {
    const label = getMovementLabel(m);
    if (label === "DECLINING") decliningCount++;
    else if (label === "STABLE") stableCount++;
    else if (label === "IMPROVING") improvingCount++;
  }
  return { decliningCount, stableCount, improvingCount };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function computeAssessmentAnalysis(
  tenantId: string,
  options?: AssessmentAnalysisOptions,
): Promise<AssessmentAnalysisResult> {
  const empty: AssessmentAnalysisResult = {
    students: [],
    teachers: [],
    cohorts: [],
    cycles: [],
    computedAt: new Date(),
  };

  // ── 1. Active cycles + eligible points ─────────────────────────────────────

  const cycleWhere = options?.cycleId
    ? { tenantId, id: options.cycleId, isActive: true }
    : { tenantId, isActive: true };

  const cycles = await (prisma as any).assessmentCycle.findMany({
    where: cycleWhere,
    include: {
      points: {
        where: { resultStatus: { in: ELIGIBLE_RESULT_STATUSES } },
        orderBy: { ordinal: "asc" },
        select: {
          id: true,
          label: true,
          ordinal: true,
          assessedAt: true,
        },
      },
    },
  });

  // ── 2. Pair current + previous points per cycle ─────────────────────────────

  type PointMeta = { id: string; label: string; ordinal: number; assessedAt: Date };
  type CyclePair = {
    cycleId: string;
    cycleLabel: string;
    qualificationType: string;
    current: PointMeta;
    previous: PointMeta | null;
  };

  const cyclePairs: CyclePair[] = [];
  for (const cycle of cycles as any[]) {
    const points: PointMeta[] = cycle.points;
    if (points.length === 0) continue;
    const current = points[points.length - 1];
    const previous = points.length >= 2 ? points[points.length - 2] : null;
    cyclePairs.push({
      cycleId: cycle.id,
      cycleLabel: cycle.label,
      qualificationType: cycle.qualificationType,
      current,
      previous,
    });
  }

  if (cyclePairs.length === 0) return empty;

  const allPointIds = cyclePairs.flatMap((cp) => [
    cp.current.id,
    ...(cp.previous ? [cp.previous.id] : []),
  ]);

  // ── 3. Assessments and results ──────────────────────────────────────────────

  const assessments = await (prisma as any).assessment.findMany({
    where: { tenantId, pointId: { in: allPointIds } },
    select: {
      id: true,
      pointId: true,
      subject: true,
      yearGroup: true,
      title: true,
      gradeFormat: true,
    },
  });

  if (assessments.length === 0) return empty;

  const assessmentById = new Map<string, any>(
    (assessments as any[]).map((a: any) => [a.id, a]),
  );
  const assessmentIds = (assessments as any[]).map((a: any) => a.id);

  const rawResults = await (prisma as any).assessmentResult.findMany({
    where: {
      tenantId,
      assessmentId: { in: assessmentIds },
      status: "PRESENT",
      isValid: true,
    },
    select: {
      assessmentId: true,
      studentId: true,
      rawValue: true,
      normalizedScore: true,
      normalisedGrade: true,
    },
  });

  if ((rawResults as any[]).length === 0) return empty;

  // ── 4. Students ─────────────────────────────────────────────────────────────

  const studentIds = [
    ...new Set((rawResults as any[]).map((r: any) => r.studentId)),
  ];

  const students = await (prisma as any).student.findMany({
    where: { tenantId, id: { in: studentIds } },
    select: {
      id: true,
      fullName: true,
      yearGroup: true,
      sendFlag: true,
      ppFlag: true,
      ks2MathsScaledScore: true,
      ks2ReadingScaledScore: true,
    },
  });

  const studentById = new Map<string, any>(
    (students as any[]).map((s: any) => [s.id, s]),
  );

  // ── 5. Teacher attribution via StudentSubjectTeacher ───────────────────────

  const allSubjects = await (prisma as any).subject.findMany({
    where: { tenantId },
    select: { id: true, name: true },
  });
  const subjectNameToId = new Map<string, string>(
    (allSubjects as any[]).map((s: any) => [s.name, s.id]),
  );

  const subjectTeachers = await (prisma as any).studentSubjectTeacher.findMany({
    where: { tenantId, studentId: { in: studentIds } },
    select: {
      studentId: true,
      subjectId: true,
      teacherId: true,
      effectiveFrom: true,
      effectiveTo: true,
    },
  });

  type TeacherAssignment = {
    teacherId: string;
    effectiveFrom: Date;
    effectiveTo: Date | null;
  };
  const teacherAssignmentMap = new Map<string, TeacherAssignment[]>();
  for (const st of subjectTeachers as any[]) {
    const k = `${st.studentId}:${st.subjectId}`;
    if (!teacherAssignmentMap.has(k)) teacherAssignmentMap.set(k, []);
    teacherAssignmentMap.get(k)!.push({
      teacherId: st.teacherId,
      effectiveFrom: new Date(st.effectiveFrom),
      effectiveTo: st.effectiveTo ? new Date(st.effectiveTo) : null,
    });
  }

  function findTeacher(
    studentId: string,
    subjectName: string,
    assessedAt: Date,
  ): string | null {
    const subjectId = subjectNameToId.get(subjectName);
    if (!subjectId) return null;
    const assignments = teacherAssignmentMap.get(`${studentId}:${subjectId}`) ?? [];
    const match = assignments.find(
      (a) =>
        a.effectiveFrom <= assessedAt &&
        (a.effectiveTo === null || a.effectiveTo >= assessedAt),
    );
    return match?.teacherId ?? null;
  }

  // ── 6. Teachers + departments ───────────────────────────────────────────────

  const teacherIds = [
    ...new Set((subjectTeachers as any[]).map((st: any) => st.teacherId)),
  ];

  const [teachers, deptMemberships] = await Promise.all([
    (prisma as any).user.findMany({
      where: { tenantId, id: { in: teacherIds } },
      select: { id: true, fullName: true },
    }),
    (prisma as any).departmentMembership.findMany({
      where: { tenantId },
      include: { department: { select: { name: true } } },
    }),
  ]);

  const teacherById = new Map<string, any>(
    (teachers as any[]).map((t: any) => [t.id, t]),
  );
  const teacherDepts = new Map<string, string[]>();
  for (const m of deptMemberships as any[]) {
    if (!teacherDepts.has(m.userId)) teacherDepts.set(m.userId, []);
    teacherDepts.get(m.userId)!.push(m.department.name);
  }

  // ── 7. Lookup maps ──────────────────────────────────────────────────────────

  const pointToCyclePair = new Map<string, CyclePair>();
  for (const cp of cyclePairs) {
    pointToCyclePair.set(cp.current.id, cp);
    if (cp.previous) pointToCyclePair.set(cp.previous.id, cp);
  }

  // Map assessment ID → point ID
  const assessmentToPointId = new Map<string, string>(
    (assessments as any[]).map((a: any) => [a.id, a.pointId]),
  );

  // Map "cycleId:subject:yearGroup" → current assessment ID and previous assessment ID
  const currentAssessmentMap = new Map<string, string>();
  const previousAssessmentMap = new Map<string, string>();
  for (const a of assessments as any[]) {
    const cp = pointToCyclePair.get(a.pointId);
    if (!cp) continue;
    const key = `${cp.cycleId}:${a.subject}:${a.yearGroup}`;
    if (a.pointId === cp.current.id) {
      currentAssessmentMap.set(key, a.id);
    } else if (cp.previous && a.pointId === cp.previous.id) {
      previousAssessmentMap.set(key, a.id);
    }
  }

  // Result lookup: "studentId:assessmentId" → scores
  type ResultEntry = {
    normalizedScore: number | null;
    normalisedGrade: string | null;
    rawValue: string;
  };
  const resultLookup = new Map<string, ResultEntry>();
  for (const r of rawResults as any[]) {
    resultLookup.set(`${r.studentId}:${r.assessmentId}`, {
      normalizedScore: r.normalizedScore !== null ? Number(r.normalizedScore) : null,
      normalisedGrade: r.normalisedGrade,
      rawValue: r.rawValue,
    });
  }

  // Results grouped by student (current point only, for iteration)
  const currentResultsByStudent = new Map<string, Array<{ assessmentId: string } & ResultEntry>>();
  for (const r of rawResults as any[]) {
    const pointId = assessmentToPointId.get(r.assessmentId);
    if (!pointId) continue;
    const cp = pointToCyclePair.get(pointId);
    if (!cp || pointId !== cp.current.id) continue;
    if (!currentResultsByStudent.has(r.studentId))
      currentResultsByStudent.set(r.studentId, []);
    currentResultsByStudent.get(r.studentId)!.push({
      assessmentId: r.assessmentId,
      normalizedScore: r.normalizedScore !== null ? Number(r.normalizedScore) : null,
      normalisedGrade: r.normalisedGrade,
      rawValue: r.rawValue,
    });
  }

  // ── 8. Student rows ─────────────────────────────────────────────────────────

  // Parallel structure for teacher attribution (built alongside student rows)
  type AttributionItem = {
    studentId: string;
    subject: string;
    yearGroup: string;
    assessedAt: Date;
    normalizedScore: number | null;
    movement: number | null;
    sendFlag: boolean;
    ppFlag: boolean;
    priorBand: PriorBand;
  };
  const attributionItems: AttributionItem[] = [];

  const studentRows: AssessmentStudentRow[] = [];

  for (const student of students as any[]) {
    const priorBand = getPriorBand(
      student.ks2MathsScaledScore,
      student.ks2ReadingScaledScore,
    );
    const currentResults = currentResultsByStudent.get(student.id) ?? [];
    const subjectResults: AssessmentSubjectResult[] = [];

    for (const r of currentResults) {
      const assessment = assessmentById.get(r.assessmentId);
      if (!assessment) continue;
      const pointId = assessmentToPointId.get(r.assessmentId);
      if (!pointId) continue;
      const cp = pointToCyclePair.get(pointId);
      if (!cp) continue;

      const subjectKey = `${cp.cycleId}:${assessment.subject}:${assessment.yearGroup}`;
      const prevAssessmentId = previousAssessmentMap.get(subjectKey);
      const prevEntry = prevAssessmentId
        ? resultLookup.get(`${student.id}:${prevAssessmentId}`)
        : null;

      const priorScore = prevEntry?.normalizedScore ?? null;
      const movement =
        r.normalizedScore !== null && priorScore !== null
          ? r.normalizedScore - priorScore
          : null;

      subjectResults.push({
        cycleId: cp.cycleId,
        cycleLabel: cp.cycleLabel,
        pointLabel: cp.current.label,
        subject: assessment.subject,
        yearGroup: assessment.yearGroup,
        assessmentTitle: assessment.title,
        gradeFormat: assessment.gradeFormat,
        rawValue: r.rawValue,
        normalizedScore: r.normalizedScore,
        normalisedGrade: r.normalisedGrade,
        movement,
        movementLabel: getMovementLabel(movement),
        priorNormalizedScore: priorScore,
      });

      attributionItems.push({
        studentId: student.id,
        subject: assessment.subject,
        yearGroup: assessment.yearGroup,
        assessedAt: new Date(cp.current.assessedAt),
        normalizedScore: r.normalizedScore,
        movement,
        sendFlag: student.sendFlag,
        ppFlag: student.ppFlag,
        priorBand,
      });
    }

    const scoredSubjects = subjectResults.filter(
      (s) => s.normalizedScore !== null,
    );
    const overallMean = computeMean(scoredSubjects.map((s) => s.normalizedScore!));
    const outliers = computeOutliers(
      scoredSubjects.map((s) => ({
        subject: s.subject,
        normalizedScore: s.normalizedScore!,
      })),
    );

    studentRows.push({
      studentId: student.id,
      studentName: student.fullName,
      yearGroup: student.yearGroup,
      sendFlag: student.sendFlag,
      ppFlag: student.ppFlag,
      priorBand,
      ks2MathsScaledScore: student.ks2MathsScaledScore,
      ks2ReadingScaledScore: student.ks2ReadingScaledScore,
      subjects: subjectResults,
      overallMean,
      outliers,
    });
  }

  // ── 9. School-wide band averages (baseline for value-add) ───────────────────

  const schoolWideBandAverages = computeBandAverages(
    attributionItems.map((a) => ({
      normalizedScore: a.normalizedScore,
      priorBand: a.priorBand,
    })),
  );

  // ── 10. Teacher rows ────────────────────────────────────────────────────────

  // Group attribution items by teacher + subject + yearGroup
  type TeacherSubjectKey = string;
  type TeacherSubjectAccum = {
    teacherId: string;
    subject: string;
    yearGroup: string;
    students: AttributionItem[];
  };

  const teacherSubjectAccum = new Map<TeacherSubjectKey, TeacherSubjectAccum>();

  for (const item of attributionItems) {
    const teacherId = findTeacher(item.studentId, item.subject, item.assessedAt);
    if (!teacherId) continue;
    const key: TeacherSubjectKey = `${teacherId}:${item.subject}:${item.yearGroup}`;
    if (!teacherSubjectAccum.has(key)) {
      teacherSubjectAccum.set(key, {
        teacherId,
        subject: item.subject,
        yearGroup: item.yearGroup,
        students: [],
      });
    }
    teacherSubjectAccum.get(key)!.students.push(item);
  }

  const teacherSubjectGroups = new Map<string, TeacherSubjectAccum[]>();
  for (const accum of teacherSubjectAccum.values()) {
    if (!teacherSubjectGroups.has(accum.teacherId))
      teacherSubjectGroups.set(accum.teacherId, []);
    teacherSubjectGroups.get(accum.teacherId)!.push(accum);
  }

  const teacherRows: AssessmentTeacherRow[] = [];

  for (const [teacherId, subjectAccums] of teacherSubjectGroups) {
    const teacher = teacherById.get(teacherId);
    if (!teacher) continue;

    const subjectRows: AssessmentTeacherSubjectRow[] = subjectAccums.map((sa) => {
      const scored = sa.students.filter((s) => s.normalizedScore !== null);
      const meanNormalizedScore = computeMean(
        scored.map((s) => s.normalizedScore!),
      );
      const movement = computeMean(
        sa.students
          .filter((s) => s.movement !== null)
          .map((s) => s.movement!),
      );
      const valueAdd = computeValueAdd(
        meanNormalizedScore,
        scored.map((s) => ({
          priorBand: s.priorBand,
          normalizedScore: s.normalizedScore,
        })),
        schoolWideBandAverages,
      );

      const sendStudents = scored.filter((s) => s.sendFlag);
      const nonSendStudents = scored.filter((s) => !s.sendFlag);
      const ppStudents = scored.filter((s) => s.ppFlag);
      const nonPpStudents = scored.filter((s) => !s.ppFlag);

      const sendMean = groupMean(sendStudents);
      const nonSendMean = groupMean(nonSendStudents);
      const ppMean = groupMean(ppStudents);
      const nonPpMean = groupMean(nonPpStudents);

      const { decliningCount, stableCount, improvingCount } = countMovements(
        sa.students.map((s) => s.movement),
      );

      return {
        subject: sa.subject,
        yearGroup: sa.yearGroup,
        studentCount: sa.students.length,
        meanNormalizedScore,
        movement,
        valueAdd,
        sendMean,
        nonSendMean,
        sendGap: computeGap(nonSendMean, sendMean),
        ppMean,
        nonPpMean,
        ppGap: computeGap(nonPpMean, ppMean),
        decliningCount,
        stableCount,
        improvingCount,
      };
    });

    const allMeans = subjectRows
      .map((s) => s.meanNormalizedScore)
      .filter((m): m is number => m !== null);
    const overallMean = computeMean(allMeans);

    const allVAs = subjectRows
      .map((s) => s.valueAdd)
      .filter((v): v is number => v !== null);
    const overallValueAdd = computeMean(allVAs);

    teacherRows.push({
      teacherId,
      teacherName: teacher.fullName,
      departmentNames: teacherDepts.get(teacherId) ?? [],
      subjects: subjectRows,
      overallMean,
      overallValueAdd,
    });
  }

  // Sort: lowest value-add first (most concern at top); nulls last
  teacherRows.sort((a, b) => {
    if (a.overallValueAdd === null && b.overallValueAdd === null) return 0;
    if (a.overallValueAdd === null) return 1;
    if (b.overallValueAdd === null) return -1;
    return a.overallValueAdd - b.overallValueAdd;
  });

  // ── 11. Cohort rows ─────────────────────────────────────────────────────────

  type CohortKey = string;
  type CohortAccum = {
    yearGroup: string;
    subject: string;
    students: AttributionItem[];
  };

  const cohortAccum = new Map<CohortKey, CohortAccum>();
  for (const item of attributionItems) {
    const ck: CohortKey = `${item.yearGroup}:${item.subject}`;
    if (!cohortAccum.has(ck))
      cohortAccum.set(ck, {
        yearGroup: item.yearGroup,
        subject: item.subject,
        students: [],
      });
    cohortAccum.get(ck)!.students.push(item);
  }

  const cohortRows: AssessmentCohortRow[] = [];

  for (const ca of cohortAccum.values()) {
    const scored = ca.students.filter((s) => s.normalizedScore !== null);
    const meanNormalizedScore = computeMean(scored.map((s) => s.normalizedScore!));
    const movement = computeMean(
      ca.students
        .filter((s) => s.movement !== null)
        .map((s) => s.movement!),
    );

    const lowPrior = scored.filter((s) => s.priorBand === "LOW");
    const midPrior = scored.filter((s) => s.priorBand === "MID");
    const highPrior = scored.filter((s) => s.priorBand === "HIGH");

    const sendStudents = scored.filter((s) => s.sendFlag);
    const nonSendStudents = scored.filter((s) => !s.sendFlag);
    const ppStudents = scored.filter((s) => s.ppFlag);
    const nonPpStudents = scored.filter((s) => !s.ppFlag);

    const sendMean = groupMean(sendStudents);
    const nonSendMean = groupMean(nonSendStudents);
    const ppMean = groupMean(ppStudents);
    const nonPpMean = groupMean(nonPpStudents);

    const { decliningCount, stableCount, improvingCount } = countMovements(
      ca.students.map((s) => s.movement),
    );

    cohortRows.push({
      yearGroup: ca.yearGroup,
      subject: ca.subject,
      studentCount: ca.students.length,
      meanNormalizedScore,
      movement,
      lowPriorMean: groupMean(lowPrior),
      midPriorMean: groupMean(midPrior),
      highPriorMean: groupMean(highPrior),
      sendMean,
      nonSendMean,
      sendGap: computeGap(nonSendMean, sendMean),
      ppMean,
      nonPpMean,
      ppGap: computeGap(nonPpMean, ppMean),
      decliningCount,
      stableCount,
      improvingCount,
    });
  }

  cohortRows.sort((a, b) => {
    const yg = a.yearGroup.localeCompare(b.yearGroup);
    if (yg !== 0) return yg;
    return a.subject.localeCompare(b.subject);
  });

  return {
    students: studentRows,
    teachers: teacherRows,
    cohorts: cohortRows,
    cycles: cyclePairs.map((cp) => ({
      cycleId: cp.cycleId,
      cycleLabel: cp.cycleLabel,
      qualificationType: cp.qualificationType,
      currentPointLabel: cp.current.label,
      previousPointLabel: cp.previous?.label ?? null,
    })),
    computedAt: new Date(),
  };
}
