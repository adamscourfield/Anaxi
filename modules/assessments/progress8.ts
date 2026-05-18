import { prisma } from "@/lib/prisma";
import { PROGRESS8_BENCHMARKS } from "./progress8Benchmarks";

type BenchmarkRow = {
  ks2AverageScaledScore: number;
  expectedAttainment8: number;
  zeroProgress8GradeEquivalent: number;
};

type ScoredResult = {
  assessmentId: string;
  studentId: string;
  subject: string;
  rawValue: string;
  normalizedScore: number | null;
  status: string;
};

type StudentProgress8Row = {
  studentId: string;
  actualAttainment8: number | null;
  expectedAttainment8: number | null;
  predictedProgress8: number | null;
};

export type Progress8DashboardSummary = {
  studentCountWithExpected: number;
  studentCountWithActual: number;
  studentCountWithPrediction: number;
  averageActualAttainment8: number | null;
  averageExpectedAttainment8: number | null;
  averagePredictedProgress8: number | null;
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return round2(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function pointsFromNormalizedScore(normalizedScore: number | null): number | null {
  if (normalizedScore === null) return null;
  return round2(Math.max(0, Math.min(9, normalizedScore * 9)));
}

function isMathsSubject(subject: string): boolean {
  return /^(math|maths|mathematics)$/i.test(subject.trim());
}

function isEnglishLanguageSubject(subject: string): boolean {
  return /(english(\s+language)?|eng\s*lang)/i.test(subject) && !/literature|lit\b/i.test(subject);
}

function isEnglishLiteratureSubject(subject: string): boolean {
  return /(english\s+literature|eng\s*lit|literature)/i.test(subject);
}

function isCombinedScienceSubject(subject: string): boolean {
  return /combined\s+science|science\s+double/i.test(subject);
}

function isEbaccSubject(subject: string): boolean {
  const normalized = subject.trim().toLowerCase();
  if (isMathsSubject(normalized) || isEnglishLanguageSubject(normalized) || isEnglishLiteratureSubject(normalized)) {
    return false;
  }
  return (
    /biology|chemistry|physics|combined science|computer science|history|geography/.test(normalized) ||
    /french|german|spanish|italian|latin|greek|mandarin|chinese|urdu|arabic|russian|japanese|portuguese/.test(normalized)
  );
}

function getCandidateMultiplicity(subject: string): number {
  return isCombinedScienceSubject(subject) ? 2 : 1;
}

function getProgress8BenchmarkLookupScore(reading: number | null, maths: number | null): number | null {
  if (reading === null || maths === null) return null;
  const averageScaledScore = (reading + maths) / 2;
  const rounded = Math.round(averageScaledScore);
  return Math.max(84, Math.min(120, rounded));
}

async function loadBenchmarks(): Promise<BenchmarkRow[]> {
  const rows = await (prisma as any).progress8Benchmark.findMany({
    orderBy: { ks2AverageScaledScore: "asc" },
  }) as BenchmarkRow[];
  return rows.length > 0 ? rows : PROGRESS8_BENCHMARKS;
}

export async function seedProgress8Benchmarks(prismaClient: typeof prisma): Promise<void> {
  for (const row of PROGRESS8_BENCHMARKS) {
    await (prismaClient as any).progress8Benchmark.upsert({
      where: { ks2AverageScaledScore: row.ks2AverageScaledScore },
      update: {
        expectedAttainment8: row.expectedAttainment8,
        zeroProgress8GradeEquivalent: row.zeroProgress8GradeEquivalent,
      },
      create: row,
    });
  }
}

export async function getExpectedAttainment8ForStudent(
  readingScaledScore: number | null | undefined,
  mathsScaledScore: number | null | undefined
): Promise<number | null> {
  const lookupScore = getProgress8BenchmarkLookupScore(readingScaledScore ?? null, mathsScaledScore ?? null);
  if (lookupScore === null) return null;
  const benchmarks = await loadBenchmarks();
  return benchmarks.find((row) => row.ks2AverageScaledScore === lookupScore)?.expectedAttainment8 ?? null;
}

function calculateStudentActualAttainment8(results: ScoredResult[]): number | null {
  const presentResults = results.filter((result) => result.status === "PRESENT");
  if (presentResults.length === 0) return null;

  const mathsCandidates = presentResults
    .filter((result) => isMathsSubject(result.subject))
    .map((result) => ({ ...result, points: pointsFromNormalizedScore(result.normalizedScore) }))
    .filter((result): result is typeof result & { points: number } => result.points !== null)
    .sort((a, b) => b.points - a.points);

  const englishLanguageCandidates = presentResults
    .filter((result) => isEnglishLanguageSubject(result.subject))
    .map((result) => ({ ...result, points: pointsFromNormalizedScore(result.normalizedScore) }))
    .filter((result): result is typeof result & { points: number } => result.points !== null);

  const englishLiteratureCandidates = presentResults
    .filter((result) => isEnglishLiteratureSubject(result.subject))
    .map((result) => ({ ...result, points: pointsFromNormalizedScore(result.normalizedScore) }))
    .filter((result): result is typeof result & { points: number } => result.points !== null);

  const usedKeys = new Set<string>();
  let totalPoints = 0;

  const mathsResult = mathsCandidates[0] ?? null;
  if (mathsResult) {
    totalPoints += mathsResult.points * 2;
    usedKeys.add(`${mathsResult.assessmentId}:${mathsResult.subject}`);
  }

  const allEnglish = [...englishLanguageCandidates, ...englishLiteratureCandidates].sort((a, b) => b.points - a.points);
  const bestEnglish = allEnglish[0] ?? null;
  if (bestEnglish) {
    const hasBothEnglishTypes = englishLanguageCandidates.length > 0 && englishLiteratureCandidates.length > 0;
    totalPoints += bestEnglish.points * (hasBothEnglishTypes ? 2 : 1);
    usedKeys.add(`${bestEnglish.assessmentId}:${bestEnglish.subject}`);
  }

  const ebaccCandidates = presentResults
    .filter((result) => isEbaccSubject(result.subject))
    .flatMap((result) => {
      const points = pointsFromNormalizedScore(result.normalizedScore);
      if (points === null) return [];
      return Array.from({ length: getCandidateMultiplicity(result.subject) }, (_, idx) => ({
        key: `${result.assessmentId}:${result.subject}:ebacc:${idx}`,
        familyKey: `${result.assessmentId}:${result.subject}`,
        points,
      }));
    })
    .sort((a, b) => b.points - a.points);

  const chosenEbacc = ebaccCandidates.slice(0, 3);
  totalPoints += chosenEbacc.reduce((sum, candidate) => sum + candidate.points, 0);
  chosenEbacc.forEach((candidate) => usedKeys.add(candidate.familyKey));

  const openCandidates = presentResults
    .filter((result) => !isMathsSubject(result.subject))
    .flatMap((result) => {
      const familyKey = `${result.assessmentId}:${result.subject}`;
      if (usedKeys.has(familyKey)) return [];
      const points = pointsFromNormalizedScore(result.normalizedScore);
      if (points === null) return [];
      return Array.from({ length: getCandidateMultiplicity(result.subject) }, (_, idx) => ({
        key: `${familyKey}:open:${idx}`,
        points,
      }));
    })
    .sort((a, b) => b.points - a.points)
    .slice(0, 3);

  totalPoints += openCandidates.reduce((sum, candidate) => sum + candidate.points, 0);

  return round2(totalPoints);
}

async function buildStudentProgress8Rows(tenantId: string): Promise<StudentProgress8Row[]> {
  const activeCycle = await prisma.assessmentCycle.findFirst({
    where: { tenantId, isActive: true, qualificationType: "GCSE" },
    include: {
      points: {
        orderBy: { ordinal: "desc" },
        take: 1,
        include: {
          assessments: {
            where: { gradeFormat: "GCSE" },
            include: {
              results: {
                where: { tenantId },
                select: {
                  assessmentId: true,
                  studentId: true,
                  rawValue: true,
                  normalizedScore: true,
                  status: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const latestPoint = activeCycle?.points[0];
  if (!latestPoint) return [];

  const students = await prisma.student.findMany({
    where: { tenantId, status: "ACTIVE" },
    select: {
      id: true,
      ks2ReadingScaledScore: true,
      ks2MathsScaledScore: true,
    },
  });

  const benchmarkRows = await loadBenchmarks();
  const benchmarkByScore = new Map(
    benchmarkRows.map((row) => [row.ks2AverageScaledScore, row.expectedAttainment8])
  );

  const resultsByStudent = new Map<string, ScoredResult[]>();
  for (const assessment of latestPoint.assessments) {
    for (const result of assessment.results) {
      const list = resultsByStudent.get(result.studentId) ?? [];
      list.push({
        assessmentId: result.assessmentId,
        studentId: result.studentId,
        subject: assessment.subject,
        rawValue: result.rawValue,
        normalizedScore: result.normalizedScore,
        status: result.status,
      });
      resultsByStudent.set(result.studentId, list);
    }
  }

  return students.map((student) => {
    const benchmarkScore = getProgress8BenchmarkLookupScore(
      student.ks2ReadingScaledScore,
      student.ks2MathsScaledScore
    );
    const expectedAttainment8 =
      benchmarkScore !== null ? (benchmarkByScore.get(benchmarkScore) ?? null) : null;
    const actualAttainment8 = calculateStudentActualAttainment8(resultsByStudent.get(student.id) ?? []);
    const predictedProgress8 =
      actualAttainment8 !== null && expectedAttainment8 !== null
        ? round2((actualAttainment8 - expectedAttainment8) / 10)
        : null;

    return {
      studentId: student.id,
      actualAttainment8,
      expectedAttainment8,
      predictedProgress8,
    };
  });
}

export async function getProgress8DashboardSummary(tenantId: string): Promise<Progress8DashboardSummary | null> {
  const rows = await buildStudentProgress8Rows(tenantId);
  if (rows.length === 0) return null;

  const actualValues = rows
    .map((row) => row.actualAttainment8)
    .filter((value): value is number => value !== null);
  const expectedValues = rows
    .map((row) => row.expectedAttainment8)
    .filter((value): value is number => value !== null);
  const predictedValues = rows
    .map((row) => row.predictedProgress8)
    .filter((value): value is number => value !== null);

  return {
    studentCountWithActual: actualValues.length,
    studentCountWithExpected: expectedValues.length,
    studentCountWithPrediction: predictedValues.length,
    averageActualAttainment8: average(actualValues),
    averageExpectedAttainment8: average(expectedValues),
    averagePredictedProgress8: average(predictedValues),
  };
}

// ─── Per-point Progress 8 analysis ───────────────────────────────────────────

export type StudentP8Detail = {
  studentId: string;
  name: string;
  yearGroup: string | null;
  ppFlag: boolean;
  sendFlag: boolean;
  hasKs2Data: boolean;
  expectedA8: number | null;
  actualA8: number | null;
  p8: number | null;
};

export type Progress8PointSummary = {
  applicable: boolean;
  cohort: {
    averageP8: number | null;
    positiveCount: number;
    negativeCount: number;
    zeroCount: number;
    totalWithP8: number;
    totalStudents: number;
    missingKs2: number;
  };
  byYearGroup: Array<{
    yearGroup: string;
    averageP8: number | null;
    count: number;
    positiveCount: number;
  }>;
  ppSummary: { averageP8: number | null; count: number };
  sendSummary: { averageP8: number | null; count: number };
  students: StudentP8Detail[];
};

export async function getProgress8ForPoint(
  pointId: string,
  tenantId: string
): Promise<Progress8PointSummary> {
  const empty: Progress8PointSummary = {
    applicable: false,
    cohort: { averageP8: null, positiveCount: 0, negativeCount: 0, zeroCount: 0, totalWithP8: 0, totalStudents: 0, missingKs2: 0 },
    byYearGroup: [],
    ppSummary: { averageP8: null, count: 0 },
    sendSummary: { averageP8: null, count: 0 },
    students: [],
  };

  const point = await prisma.assessmentPoint.findFirst({
    where: { id: pointId, cycle: { tenantId } },
    include: {
      cycle: { select: { qualificationType: true } },
      assessments: {
        where: { gradeFormat: "GCSE" },
        select: {
          id: true,
          subject: true,
          results: {
            where: { tenantId },
            select: {
              assessmentId: true,
              studentId: true,
              rawValue: true,
              normalizedScore: true,
              status: true,
            },
          },
        },
      },
    },
  });

  if (!point || point.cycle.qualificationType !== "GCSE") return empty;

  const studentIds = [
    ...new Set(point.assessments.flatMap((a) => a.results.map((r) => r.studentId))),
  ];
  if (studentIds.length === 0) return { ...empty, applicable: true };

  const students = await prisma.student.findMany({
    where: { id: { in: studentIds }, tenantId },
    select: {
      id: true,
      fullName: true,
      yearGroup: true,
      ppFlag: true,
      sendFlag: true,
      ks2ReadingScaledScore: true,
      ks2MathsScaledScore: true,
    },
  });

  const benchmarkRows = await loadBenchmarks();
  const benchmarkByScore = new Map(
    benchmarkRows.map((row) => [row.ks2AverageScaledScore, row.expectedAttainment8])
  );

  const resultsByStudent = new Map<string, ScoredResult[]>();
  for (const assessment of point.assessments) {
    for (const result of assessment.results) {
      const list = resultsByStudent.get(result.studentId) ?? [];
      list.push({
        assessmentId: result.assessmentId,
        studentId: result.studentId,
        subject: assessment.subject,
        rawValue: result.rawValue,
        normalizedScore: result.normalizedScore,
        status: result.status,
      });
      resultsByStudent.set(result.studentId, list);
    }
  }

  const details: StudentP8Detail[] = students.map((student) => {
    const lookupScore = getProgress8BenchmarkLookupScore(
      student.ks2ReadingScaledScore,
      student.ks2MathsScaledScore
    );
    const expectedA8 = lookupScore !== null ? (benchmarkByScore.get(lookupScore) ?? null) : null;
    const actualA8 = calculateStudentActualAttainment8(resultsByStudent.get(student.id) ?? []);
    const p8 =
      actualA8 !== null && expectedA8 !== null
        ? round2((actualA8 - expectedA8) / 10)
        : null;

    return {
      studentId: student.id,
      name: student.fullName,
      yearGroup: student.yearGroup,
      ppFlag: student.ppFlag,
      sendFlag: student.sendFlag,
      hasKs2Data:
        student.ks2ReadingScaledScore !== null && student.ks2MathsScaledScore !== null,
      expectedA8,
      actualA8,
      p8,
    };
  });

  details.sort((a, b) => {
    if (a.p8 === null && b.p8 === null) return 0;
    if (a.p8 === null) return 1;
    if (b.p8 === null) return -1;
    return b.p8 - a.p8;
  });

  const withP8 = details.filter((d) => d.p8 !== null);
  const p8Values = withP8.map((d) => d.p8 as number);

  const byYearGroupMap = new Map<string, { p8s: number[]; positiveCount: number }>();
  for (const d of details) {
    if (d.p8 === null) continue;
    const yg = d.yearGroup ?? "Unknown";
    const entry = byYearGroupMap.get(yg) ?? { p8s: [], positiveCount: 0 };
    entry.p8s.push(d.p8);
    if (d.p8 > 0.05) entry.positiveCount++;
    byYearGroupMap.set(yg, entry);
  }
  const byYearGroup = [...byYearGroupMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([yearGroup, { p8s, positiveCount }]) => ({
      yearGroup,
      averageP8: average(p8s),
      count: p8s.length,
      positiveCount,
    }));

  const ppValues = details
    .filter((d) => d.ppFlag && d.p8 !== null)
    .map((d) => d.p8 as number);
  const sendValues = details
    .filter((d) => d.sendFlag && d.p8 !== null)
    .map((d) => d.p8 as number);

  return {
    applicable: true,
    cohort: {
      averageP8: average(p8Values),
      positiveCount: p8Values.filter((v) => v > 0.05).length,
      negativeCount: p8Values.filter((v) => v < -0.05).length,
      zeroCount: p8Values.filter((v) => v >= -0.05 && v <= 0.05).length,
      totalWithP8: withP8.length,
      totalStudents: details.length,
      missingKs2: details.filter((d) => !d.hasKs2Data).length,
    },
    byYearGroup,
    ppSummary: { averageP8: average(ppValues), count: ppValues.length },
    sendSummary: { averageP8: average(sendValues), count: sendValues.length },
    students: details,
  };
}
