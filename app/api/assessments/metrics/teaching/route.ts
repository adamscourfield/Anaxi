/**
 * GET /api/assessments/metrics/teaching
 *
 * Teaching Group Analysis for a result point.
 * Joins AssessmentResults → StudentSubjectTeacher to identify class groupings,
 * computes per-class mean vs year mean, and optionally surfaces observation signals.
 *
 * Query params:
 *   pointId — required
 */

import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import type { GradeFormat } from "@prisma/client";
import { withApi } from "@/lib/apiRoute";

const A_LEVEL_SCORE: Record<string, number> = {
  "A*": 7, A: 6, B: 5, C: 4, D: 3, E: 2, U: 1,
};

/** Convert a normalised score (0–1) to a display percentage or grade string. */
function displayScore(score: number, format: GradeFormat): string {
  if (format === "GCSE") return (score * 9).toFixed(1);
  if (format === "A_LEVEL") {
    const g = score * 7;
    if (g >= 6.5) return "A*";
    if (g >= 5.5) return "A";
    if (g >= 4.5) return "B";
    if (g >= 3.5) return "C";
    if (g >= 2.5) return "D";
    if (g >= 1.5) return "E";
    return "U";
  }
  return `${Math.round(score * 100)}%`;
}

function mean(vals: number[]): number | null {
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function round1(v: number | null): number | null {
  return v !== null ? Math.round(v * 10) / 10 : null;
}

function historicPointDate(point: {
  assessedAt: Date;
  dateTaken: Date | null;
  label: string;
  dataSource: string;
  cycle: { academicYear: string };
}): Date {
  if (point.dateTaken) return point.dateTaken;
  if (point.dataSource !== "ARBOR") return point.assessedAt;

  const startYear = Number(point.cycle.academicYear.slice(0, 4));
  if (!Number.isInteger(startYear)) return point.assessedAt;
  if (point.label === "Autumn") return new Date(Date.UTC(startYear, 11, 15));
  if (point.label === "Spring") return new Date(Date.UTC(startYear + 1, 2, 31));
  if (point.label === "Summer") return new Date(Date.UTC(startYear + 1, 6, 15));
  if (point.label === "Final") return new Date(Date.UTC(startYear + 1, 7, 31));
  return point.assessedAt;
}

function academicYearStart(date: Date): number {
  return date.getUTCFullYear() - (date.getUTCMonth() < 8 ? 1 : 0);
}

function isHistoricCycle(academicYear: string): boolean {
  const startYear = Number(academicYear.slice(0, 4));
  return Number.isInteger(startYear) && startYear < academicYearStart(new Date());
}

/** Arbor class labels may use either 2025/26 or 2025/2026 for the same year. */
function academicYearLabelVariants(academicYear: string): string[] {
  const match = academicYear.match(/(\d{4})\s*(?:\/|-)\s*(\d{2}|\d{4})/);
  if (!match) return [academicYear];
  const [, start, end] = match;
  const fullEnd = end.length === 2 ? `${start.slice(0, 2)}${end}` : end;
  return [...new Set([`${start}/${fullEnd}`, `${start}/${fullEnd.slice(-2)}`])];
}

/**
 * Arbor's timetable subject and its assessment label are not always identical
 * (for example, "% Y10 Chemistry" and "Chemistry"). Match only safe label
 * variants; the caller still rejects a key that resolves to multiple classes.
 */
function subjectKey(value: string): string {
  return value
    .toLocaleLowerCase("en-GB")
    .replace(/&/g, " and ")
    .replace(/^\s*(?:p8\s*:\s*)?%?\s*(?:y|year)\s*\d+\s*/i, "")
    .replace(/^\s*a\s*level\s+/i, "")
    .replace(/\s+gcse(?:\s*\(level\s*1\s*\/\s*2\))?/gi, "")
    .replace(/\s*\(level\s*1\s*\/\s*2\)/gi, "")
    .replace(/mathematics/g, "maths")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

/** The leading segment of Arbor's class label is its displayed class subject. */
function classSubjectKey(className: string | null): string {
  return subjectKey((className ?? "").split(":", 1)[0] ?? "");
}

export const GET = withApi(async function GET(req: Request) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ASSESSMENTS");

  const { searchParams } = new URL(req.url);
  const pointId = searchParams.get("pointId");

  if (!pointId) {
    return NextResponse.json({ error: "pointId is required" }, { status: 400 });
  }

  // ── 1. Load the result point ─────────────────────────────────────────────
  const point = await prisma.assessmentPoint.findFirst({
    where: { id: pointId, tenantId: user.tenantId },
    select: {
      assessedAt: true,
      dateTaken: true,
      label: true,
      dataSource: true,
      cycle: { select: { academicYear: true } },
    },
  });
  if (!point) {
    return NextResponse.json({ error: "Point not found" }, { status: 404 });
  }
  const assessedAt = historicPointDate(point);
  const historicCycle = isHistoricCycle(point.cycle.academicYear);
  const historicClassYearLabels = academicYearLabelVariants(point.cycle.academicYear);

  // ── 2. Load all assessments + results ────────────────────────────────────
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
          ppFlag: true,
          sendFlag: true,
          normalizedScore: true,
          rawValue: true,
          student: {
            select: {
              id: true,
              fullName: true,
              ppFlag: true,
              sendFlag: true,
            },
          },
        },
      },
    },
    orderBy: { subject: "asc" },
  });

  if (!assessments.length) {
    return NextResponse.json({ error: "No assessments found for this point" }, { status: 404 });
  }

  // ── 3. Load StudentSubjectTeacher for all students + subjects at this point ──
  const studentIds = [...new Set(assessments.flatMap((a) => a.results.map((r) => r.studentId)))];
  const subjectNames = [...new Set(assessments.map((a) => a.subject))];

  // Find subjects by name in this tenant
  const subjectRecords = await prisma.subject.findMany({
    where: { tenantId: user.tenantId, name: { in: subjectNames } },
    select: { id: true, name: true },
  });
  const subjectIdByName = new Map(subjectRecords.map((s) => [s.name, s.id]));

  // Count each historic roster boundary independently. This is retained in the
  // response when a point has no eligible assignments so we can distinguish a
  // missing roster from an academic-year or assessment-date mismatch.
  const historicRosterScope = historicCycle
    ? await Promise.all([
        prisma.studentSubjectTeacher.count({
          where: { tenantId: user.tenantId, dataSource: "ARBOR", studentId: { in: studentIds } },
        }),
        prisma.studentSubjectTeacher.count({
          where: {
            tenantId: user.tenantId,
            dataSource: "ARBOR",
            studentId: { in: studentIds },
            OR: historicClassYearLabels.map((label) => ({ className: { contains: label } })),
          },
        }),
        prisma.studentSubjectTeacher.count({
          where: {
            tenantId: user.tenantId,
            dataSource: "ARBOR",
            studentId: { in: studentIds },
            OR: historicClassYearLabels.map((label) => ({ className: { contains: label } })),
            effectiveFrom: { lte: assessedAt },
            AND: [{ OR: [{ effectiveTo: null }, { effectiveTo: { gte: assessedAt } }] }],
          },
        }),
      ])
    : null;

  // Current points use their effective dates. A historic import has an
  // explicit year inside its Arbor class label (for example, "7A/En
  // (2025/2026)"); that immutable label is the safer evidence. Arbor's
  // imported membership dates are not reliable enough to reject a correctly
  // labelled former class at the end of an academic year.
  const assignments = await prisma.studentSubjectTeacher.findMany({
    where: {
      tenantId: user.tenantId,
      studentId: { in: studentIds },
      // Teacher impact is based on verified Arbor classroom links only. This
      // prevents a legacy or manually-created assignment from attributing a
      // historic assessment to a teacher who was not teaching that class.
      dataSource: "ARBOR",
      // Arbor's dated class labels are the final safeguard for historic
      // attribution. Some enrolment records omit dates, so a current class
      // must never qualify merely because it has a broad effective range.
      ...(historicCycle
        ? {
            AND: [{
              OR: historicClassYearLabels.map((label) => ({ className: { contains: label } })),
            }],
          }
        : {}),
      ...(!historicCycle
        ? {
            effectiveFrom: { lte: assessedAt },
            OR: [
              { effectiveTo: null },
              { effectiveTo: { gte: assessedAt } },
            ],
          }
        : {}),
    },
    select: {
      studentId: true,
      subjectId: true,
      teacherId: true,
      className: true,
      subject: { select: { name: true } },
      teacher: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
    },
  });

  // Historic impact is available only once the former academic year's dated
  // class roster has been imported. Never fall back to a current class.
  if (historicCycle && !assignments.length) {
    return NextResponse.json({
      pointId,
      assessedAt: assessedAt.toISOString(),
      subjects: [],
      historicalClassRostersAvailable: false,
      historicalRosterDiagnostic: historicRosterScope
        ? {
            rosterLinks: 0,
            studentsWithRoster: 0,
            resultsChecked: 0,
            exactSubjectMatches: 0,
            labelVariantMatches: 0,
            missingStudentRoster: 0,
            missingSubjectRoster: 0,
            pupilLinks: historicRosterScope[0],
            academicYearLinks: historicRosterScope[1],
            dateEligibleLinks: historicRosterScope[2],
          }
        : undefined,
    }, { headers: { "Cache-Control": "private, no-store" } });
  }

  type DatedAssignment = { teacherId: string; className: string };
  // First prefer Anaxi's exact subject ID. The secondary map is only for safe
  // Arbor label variants, and is used only when it identifies one class.
  const studentSubjectTeacher = new Map<string, Map<string, DatedAssignment[]>>();
  const studentSubjectKeyAssignments = new Map<string, Map<string, DatedAssignment[]>>();
  const teacherInfoMap = new Map<string, { id: string; fullName: string; email: string }>();
  const historicRosterDiagnostic = {
    rosterLinks: assignments.length,
    studentsWithRoster: 0,
    resultsChecked: 0,
    exactSubjectMatches: 0,
    labelVariantMatches: 0,
    missingStudentRoster: 0,
    missingSubjectRoster: 0,
    pupilLinks: historicRosterScope?.[0] ?? assignments.length,
    academicYearLinks: historicRosterScope?.[1] ?? assignments.length,
    dateEligibleLinks: historicRosterScope?.[2] ?? assignments.length,
  };

  for (const a of assignments) {
    if (!studentSubjectTeacher.has(a.studentId)) {
      studentSubjectTeacher.set(a.studentId, new Map());
    }
    const datedAssignment = {
      teacherId: a.teacherId,
      className: a.className?.trim() || "Class not recorded",
    };
    const bySubjectId = studentSubjectTeacher.get(a.studentId)!;
    // A pupil can legitimately have more than one historic membership whose
    // Arbor subject resolves to the same Anaxi subject. Keep them all here;
    // selecting the last database row would silently credit every result to
    // whichever teacher happened to be returned last.
    bySubjectId.set(a.subjectId, [...(bySubjectId.get(a.subjectId) ?? []), datedAssignment]);
    if (!studentSubjectKeyAssignments.has(a.studentId)) {
      studentSubjectKeyAssignments.set(a.studentId, new Map());
    }
    const bySubjectKey = studentSubjectKeyAssignments.get(a.studentId)!;
    // Arbor's subject relation can be broad (for example, "Art and Design")
    // while its dated class is labelled "Art: Year 7: 7A/Ar". Both are kept
    // as possible keys; assignmentFor accepts one only when it is unambiguous.
    const keys = new Set([subjectKey(a.subject.name), classSubjectKey(a.className)]);
    for (const key of keys) {
      if (key) bySubjectKey.set(key, [...(bySubjectKey.get(key) ?? []), datedAssignment]);
    }
    if (!teacherInfoMap.has(a.teacherId)) {
      teacherInfoMap.set(a.teacherId, {
        id: a.teacher.id,
        fullName: a.teacher.fullName,
        email: a.teacher.email,
      });
    }
  }

  function assignmentFor(studentId: string, subjectId: string | undefined, assessmentSubject: string): DatedAssignment | null {
    if (historicCycle) {
      historicRosterDiagnostic.resultsChecked++;
      if (studentSubjectTeacher.has(studentId)) historicRosterDiagnostic.studentsWithRoster++;
      else historicRosterDiagnostic.missingStudentRoster++;
    }
    const exactMatches = subjectId ? studentSubjectTeacher.get(studentId)?.get(subjectId) ?? [] : [];
    const exactUniqueMatches = new Map(exactMatches.map((match) => [`${match.teacherId}:${match.className}`, match]));
    if (exactUniqueMatches.size === 1) {
      if (historicCycle) historicRosterDiagnostic.exactSubjectMatches++;
      return [...exactUniqueMatches.values()][0];
    }
    const matches = studentSubjectKeyAssignments.get(studentId)?.get(subjectKey(assessmentSubject)) ?? [];
    // Never guess when a simplified label could point at more than one class.
    const uniqueMatches = new Map(matches.map((match) => [`${match.teacherId}:${match.className}`, match]));
    if (uniqueMatches.size === 1) {
      if (historicCycle) historicRosterDiagnostic.labelVariantMatches++;
      return [...uniqueMatches.values()][0];
    }
    if (historicCycle && studentSubjectTeacher.has(studentId)) {
      historicRosterDiagnostic.missingSubjectRoster++;
    }
    return null;
  }

  // ── 4. Load observation signals for teachers in this year ────────────────
  // Get the academic year range based on assessedAt (Sep–Aug)
  const assessedYear = assessedAt.getMonth() >= 8 ? assessedAt.getFullYear() : assessedAt.getFullYear() - 1;
  const yearStart = new Date(`${assessedYear}-09-01`);
  const yearEnd = new Date(`${assessedYear + 1}-08-31T23:59:59`);

  const teacherIds = [...teacherInfoMap.keys()];

  type ObsRow = {
    observedTeacherId: string;
    subject: string;
    signals: Array<{ signalKey: string; valueKey: string | null; notObserved: boolean }>;
  };

  let observations: ObsRow[] = [];
  if (teacherIds.length > 0) {
    const rawObs = await prisma.observation.findMany({
      where: {
        tenantId: user.tenantId,
        observedTeacherId: { in: teacherIds },
        observedAt: { gte: yearStart, lte: yearEnd },
      },
      select: {
        observedTeacherId: true,
        subject: true,
        signals: {
          select: { signalKey: true, valueKey: true, notObserved: true },
        },
      },
    });
    observations = rawObs;
  }

  // Aggregate: teacherId → subject → signal strengths
  // For each signal key, count positive (valueKey = "STRONG" or "GOOD") vs concern ("CONCERN"/"WEAK")
  type SignalSummary = {
    key: string;
    positiveCount: number;
    concernCount: number;
    totalCount: number;
  };

  const teacherSubjectSignals = new Map<string, Map<string, Map<string, SignalSummary>>>();

  for (const obs of observations) {
    const tid = obs.observedTeacherId;
    const subj = obs.subject;
    if (!teacherSubjectSignals.has(tid)) teacherSubjectSignals.set(tid, new Map());
    const subjMap = teacherSubjectSignals.get(tid)!;
    if (!subjMap.has(subj)) subjMap.set(subj, new Map());
    const sigMap = subjMap.get(subj)!;

    for (const sig of obs.signals) {
      if (sig.notObserved) continue;
      if (!sigMap.has(sig.signalKey)) {
        sigMap.set(sig.signalKey, { key: sig.signalKey, positiveCount: 0, concernCount: 0, totalCount: 0 });
      }
      const entry = sigMap.get(sig.signalKey)!;
      entry.totalCount++;
      const v = sig.valueKey?.toUpperCase() ?? "";
      if (v === "STRONG" || v === "GOOD" || v === "POSITIVE") entry.positiveCount++;
      else if (v === "CONCERN" || v === "WEAK" || v === "NEGATIVE") entry.concernCount++;
    }
  }

  // Count total observations per teacher per subject
  const teacherSubjectObsCount = new Map<string, Map<string, number>>();
  for (const obs of observations) {
    const tid = obs.observedTeacherId;
    const subj = obs.subject;
    if (!teacherSubjectObsCount.has(tid)) teacherSubjectObsCount.set(tid, new Map());
    const m = teacherSubjectObsCount.get(tid)!;
    m.set(subj, (m.get(subj) ?? 0) + 1);
  }

  // ── 5. Build per-subject, per-class statistics ────────────────────────────
  type StudentRow = {
    studentId: string;
    name: string;
    ppFlag: boolean;
    sendFlag: boolean;
    score: number | null;
    displayScore: string;
  };

  type ClassStat = {
    teacherId: string;
    teacherName: string;
    teacherEmail: string;
    className: string;
    count: number;
    mean: number | null;
    meanDisplay: string | null;
    vsYearMean: number | null;
    observationCount: number;
    topSignals: SignalSummary[];
    students: StudentRow[];
  };

  type TeacherImpactStat = Omit<ClassStat, "className" | "students"> & { classNames: string[] };

  type SubjectStat = {
    subject: string;
    gradeFormat: GradeFormat;
    yearMean: number | null;
    yearMeanDisplay: string | null;
    presentCount: number;
    classes: ClassStat[];
    teacherImpact: TeacherImpactStat[];
    unassigned: StudentRow[];
  };

  const subjectStats: SubjectStat[] = [];

  for (const asmt of assessments) {
    const subjectId = subjectIdByName.get(asmt.subject);

    // Compute year mean
    const allScores = asmt.results
      .map((r) => r.normalizedScore)
      .filter((s): s is number => s !== null);
    const yearMeanVal = mean(allScores);

    // Group by teacher and actual class, not merely by teacher. A teacher can
    // teach several classes in the same subject and each must be measured on
    // its own results.
    const classStudents = new Map<string, { teacherId: string; className: string; students: StudentRow[] }>();
    const unassigned: StudentRow[] = [];

    for (const r of asmt.results) {
      const assignment = assignmentFor(r.studentId, subjectId, asmt.subject);

      const sRow: StudentRow = {
        studentId: r.studentId,
        name: r.student.fullName,
        ppFlag: (r.ppFlag ?? r.student.ppFlag),
        sendFlag: (r.sendFlag ?? r.student.sendFlag),
        score: r.normalizedScore,
        displayScore: r.normalizedScore !== null
          ? displayScore(r.normalizedScore, asmt.gradeFormat)
          : r.rawValue,
      };

      if (assignment) {
        const key = `${assignment.teacherId}:${assignment.className}`;
        if (!classStudents.has(key)) classStudents.set(key, { ...assignment, students: [] });
        classStudents.get(key)!.students.push(sRow);
      } else {
        unassigned.push(sRow);
      }
    }

    // Build class stats
    const classes: ClassStat[] = [];
    for (const { teacherId, className, students } of classStudents.values()) {
      const teacher = teacherInfoMap.get(teacherId);
      const teacherName = teacher
        ? teacher.fullName || teacher.email
        : "Unknown Teacher";

      const scores = students.map((s) => s.score).filter((s): s is number => s !== null);
      const classMean = mean(scores);
      const vsYear = classMean !== null && yearMeanVal !== null
        ? classMean - yearMeanVal
        : null;

      // Get obs signals for this teacher in this subject
      const sigMap = teacherSubjectSignals.get(teacherId)?.get(asmt.subject) ?? new Map();
      const topSignals = [...sigMap.values()]
        .filter((s) => s.totalCount >= 2)
        .sort((a, b) => b.totalCount - a.totalCount)
        .slice(0, 5);

      const obsCount = teacherSubjectObsCount.get(teacherId)?.get(asmt.subject) ?? 0;

      classes.push({
        teacherId,
        teacherName,
        teacherEmail: teacher?.email ?? "",
        className,
        count: students.length,
        mean: classMean,
        meanDisplay: classMean !== null ? displayScore(classMean, asmt.gradeFormat) : null,
        vsYearMean: vsYear !== null ? Math.round(vsYear * (asmt.gradeFormat === "GCSE" ? 9 : asmt.gradeFormat === "A_LEVEL" ? 7 : 100) * 10) / 10 : null,
        observationCount: obsCount,
        topSignals,
        students: students.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)),
      });
    }

    // Sort classes by mean descending (best first)
    classes.sort((a, b) => (b.mean ?? 0) - (a.mean ?? 0));

    const teacherImpact = new Map<string, ClassStat[]>();
    for (const classStat of classes) {
      if (!teacherImpact.has(classStat.teacherId)) teacherImpact.set(classStat.teacherId, []);
      teacherImpact.get(classStat.teacherId)!.push(classStat);
    }
    const teacherImpactStats: TeacherImpactStat[] = [...teacherImpact.values()].map((teacherClasses) => {
      const [first] = teacherClasses;
      const students = teacherClasses.flatMap((classStat) => classStat.students);
      const scores = students.map((student) => student.score).filter((score): score is number => score !== null);
      const teacherMean = mean(scores);
      return {
        teacherId: first.teacherId,
        teacherName: first.teacherName,
        teacherEmail: first.teacherEmail,
        classNames: teacherClasses.map((classStat) => classStat.className).sort((a, b) => a.localeCompare(b)),
        count: students.length,
        mean: teacherMean,
        meanDisplay: teacherMean !== null ? displayScore(teacherMean, asmt.gradeFormat) : null,
        vsYearMean: teacherMean !== null && yearMeanVal !== null
          ? Math.round((teacherMean - yearMeanVal) * (asmt.gradeFormat === "GCSE" ? 9 : asmt.gradeFormat === "A_LEVEL" ? 7 : 100) * 10) / 10
          : null,
        observationCount: first.observationCount,
        topSignals: first.topSignals,
      };
    }).sort((a, b) => a.teacherName.localeCompare(b.teacherName));

    subjectStats.push({
      subject: asmt.subject,
      gradeFormat: asmt.gradeFormat,
      yearMean: yearMeanVal,
      yearMeanDisplay: yearMeanVal !== null ? displayScore(yearMeanVal, asmt.gradeFormat) : null,
      presentCount: asmt.results.length,
      classes,
      teacherImpact: teacherImpactStats,
      unassigned,
    });
  }

  return NextResponse.json({
    pointId,
    assessedAt: assessedAt.toISOString(),
    subjects: subjectStats,
    historicalClassRostersAvailable: true,
    ...(historicCycle ? { historicalRosterDiagnostic: historicRosterDiagnostic } : {}),
  }, { headers: { "Cache-Control": "private, no-store" } });
});
