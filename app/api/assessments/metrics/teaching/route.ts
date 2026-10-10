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

  // The timetable sync intentionally captures the live academic year's class
  // roster. It does not yet retain a verified historical roster. Do not use a
  // current class (for example, 8H) to attribute a prior year's result from
  // the student's former class (for example, 7H).
  if (isHistoricCycle(point.cycle.academicYear)) {
    return NextResponse.json({
      pointId,
      assessedAt: assessedAt.toISOString(),
      subjects: [],
      historicalClassRostersAvailable: false,
    }, { headers: { "Cache-Control": "private, no-store" } });
  }

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

  // Load only assignments that were active at the assessment date. In
  // particular, a current timetable assignment must never be used to explain
  // or measure a historic result.
  const assignments = await prisma.studentSubjectTeacher.findMany({
    where: {
      tenantId: user.tenantId,
      studentId: { in: studentIds },
      // Teacher impact is based on verified Arbor classroom links only. This
      // prevents a legacy or manually-created assignment from attributing a
      // historic assessment to a teacher who was not teaching that class.
      dataSource: "ARBOR",
      effectiveFrom: { lte: assessedAt },
      OR: [
        { effectiveTo: null },
        { effectiveTo: { gte: assessedAt } },
      ],
    },
    select: {
      studentId: true,
      subjectId: true,
      teacherId: true,
      className: true,
      teacher: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
    },
  });

  // Map: studentId → subjectId → dated class assignment. The class label comes
  // from the same verified link as the result attribution.
  const studentSubjectTeacher = new Map<string, Map<string, { teacherId: string; className: string }>>();
  const teacherInfoMap = new Map<string, { id: string; fullName: string; email: string }>();

  for (const a of assignments) {
    if (!studentSubjectTeacher.has(a.studentId)) {
      studentSubjectTeacher.set(a.studentId, new Map());
    }
    studentSubjectTeacher.get(a.studentId)!.set(a.subjectId, {
      teacherId: a.teacherId,
      className: a.className?.trim() || "Class not recorded",
    });
    if (!teacherInfoMap.has(a.teacherId)) {
      teacherInfoMap.set(a.teacherId, {
        id: a.teacher.id,
        fullName: a.teacher.fullName,
        email: a.teacher.email,
      });
    }
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
      const assignment = subjectId
        ? (studentSubjectTeacher.get(r.studentId)?.get(subjectId) ?? null)
        : null;

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
  }, { headers: { "Cache-Control": "private, no-store" } });
});
