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

  // Load teaching assignments effective around the assessedAt date
  const assignments = await prisma.studentSubjectTeacher.findMany({
    where: {
      tenantId: user.tenantId,
      studentId: { in: studentIds },
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
      teacher: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
    },
  });

  // Map: studentId → subjectId → teacherId
  const studentSubjectTeacher = new Map<string, Map<string, string>>();
  const teacherInfoMap = new Map<string, { id: string; fullName: string; email: string }>();

  for (const a of assignments) {
    if (!studentSubjectTeacher.has(a.studentId)) {
      studentSubjectTeacher.set(a.studentId, new Map());
    }
    studentSubjectTeacher.get(a.studentId)!.set(a.subjectId, a.teacherId);
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
    count: number;
    mean: number | null;
    meanDisplay: string | null;
    vsYearMean: number | null;
    observationCount: number;
    topSignals: SignalSummary[];
    students: StudentRow[];
  };

  type SubjectStat = {
    subject: string;
    gradeFormat: GradeFormat;
    yearMean: number | null;
    yearMeanDisplay: string | null;
    presentCount: number;
    classes: ClassStat[];
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

    // Group by teacher
    const teacherStudents = new Map<string, StudentRow[]>();
    const unassigned: StudentRow[] = [];

    for (const r of asmt.results) {
      const teacherId = subjectId
        ? (studentSubjectTeacher.get(r.studentId)?.get(subjectId) ?? null)
        : null;

      const sRow: StudentRow = {
        studentId: r.studentId,
        name: r.student.fullName,
        ppFlag: r.student.ppFlag,
        sendFlag: r.student.sendFlag,
        score: r.normalizedScore,
        displayScore: r.normalizedScore !== null
          ? displayScore(r.normalizedScore, asmt.gradeFormat)
          : r.rawValue,
      };

      if (teacherId) {
        if (!teacherStudents.has(teacherId)) teacherStudents.set(teacherId, []);
        teacherStudents.get(teacherId)!.push(sRow);
      } else {
        unassigned.push(sRow);
      }
    }

    // Build class stats
    const classes: ClassStat[] = [];
    for (const [teacherId, students] of teacherStudents) {
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

    subjectStats.push({
      subject: asmt.subject,
      gradeFormat: asmt.gradeFormat,
      yearMean: yearMeanVal,
      yearMeanDisplay: yearMeanVal !== null ? displayScore(yearMeanVal, asmt.gradeFormat) : null,
      presentCount: asmt.results.length,
      classes,
      unassigned,
    });
  }

  return NextResponse.json({
    pointId,
    assessedAt: assessedAt.toISOString(),
    subjects: subjectStats,
  });
});
