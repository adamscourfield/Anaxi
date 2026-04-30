/**
 * GET /api/assessments/metrics/teaching
 *
 * Teaching Group Analysis for a result point.
 * Joins AssessmentResults → StudentSubjectTeacher to identify class groupings,
 * computes per-class mean vs year mean, PP/SEND attainment gaps, and
 * pastoral averages (attendance, detentions) from the nearest StudentSnapshot.
 *
 * Query params:
 *   pointId — required
 */

import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import type { GradeFormat } from "@prisma/client";

/** Convert a normalised score (0–1) to a display label. */
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

/** Scale a normalised delta to the grade format's natural unit. */
function scaleVsYear(delta: number, format: GradeFormat): number {
  const factor = format === "GCSE" ? 9 : format === "A_LEVEL" ? 7 : 100;
  return Math.round(delta * factor * 10) / 10;
}

function avg(vals: number[]): number | null {
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function round1(v: number | null): number | null {
  return v !== null ? Math.round(v * 10) / 10 : null;
}

// ─── Snapshot helpers ─────────────────────────────────────────────────────────

type SnapRow = {
  studentId: string;
  snapshotDate: Date;
  attendancePct: unknown;
  latenessCount: number;
  detentionsCount: number;
  internalExclusionsCount: number;
  suspensionsCount: number;
  onCallsCount: number;
  positivePointsTotal: number;
  negativePointsTotal: number;
};

function closestSnapshot(snaps: SnapRow[], target: Date): SnapRow | null {
  if (!snaps.length) return null;
  return snaps.reduce((best, s) =>
    Math.abs(s.snapshotDate.getTime() - target.getTime()) <
    Math.abs(best.snapshotDate.getTime() - target.getTime())
      ? s
      : best
  );
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

  // ── 3. Load StudentSubjectTeacher assignments ────────────────────────────
  const studentIds = [...new Set(assessments.flatMap((a) => a.results.map((r) => r.studentId)))];
  const subjectNames = [...new Set(assessments.map((a) => a.subject))];

  const subjectRecords = await prisma.subject.findMany({
    where: { tenantId: user.tenantId, name: { in: subjectNames } },
    select: { id: true, name: true },
  });
  const subjectIdByName = new Map(subjectRecords.map((s) => [s.name, s.id]));

  const assignments = await prisma.studentSubjectTeacher.findMany({
    where: {
      tenantId: user.tenantId,
      studentId: { in: studentIds },
      effectiveFrom: { lte: assessedAt },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: assessedAt } }],
    },
    select: {
      studentId: true,
      subjectId: true,
      teacherId: true,
      teacher: { select: { id: true, fullName: true, email: true } },
    },
  });

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

  // ── 4. Load observation signals ──────────────────────────────────────────
  const assessedYear = assessedAt.getMonth() >= 8 ? assessedAt.getFullYear() : assessedAt.getFullYear() - 1;
  const yearStart = new Date(`${assessedYear}-09-01`);
  const yearEnd = new Date(`${assessedYear + 1}-08-31T23:59:59`);
  const teacherIds = [...teacherInfoMap.keys()];

  type SignalSummary = {
    key: string;
    positiveCount: number;
    concernCount: number;
    totalCount: number;
  };

  type ObsRow = {
    observedTeacherId: string;
    subject: string;
    signals: Array<{ signalKey: string; valueKey: string | null; notObserved: boolean }>;
  };

  let observations: ObsRow[] = [];
  if (teacherIds.length > 0) {
    observations = await prisma.observation.findMany({
      where: {
        tenantId: user.tenantId,
        observedTeacherId: { in: teacherIds },
        observedAt: { gte: yearStart, lte: yearEnd },
      },
      select: {
        observedTeacherId: true,
        subject: true,
        signals: { select: { signalKey: true, valueKey: true, notObserved: true } },
      },
    });
  }

  const teacherSubjectSignals = new Map<string, Map<string, Map<string, SignalSummary>>>();
  const teacherSubjectObsCount = new Map<string, Map<string, number>>();

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

    if (!teacherSubjectObsCount.has(tid)) teacherSubjectObsCount.set(tid, new Map());
    const m = teacherSubjectObsCount.get(tid)!;
    m.set(subj, (m.get(subj) ?? 0) + 1);
  }

  // ── 4b. Load snapshots for all students ──────────────────────────────────
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

  const snapsByStudent = new Map<string, SnapRow[]>();
  for (const s of allSnapshots) {
    const arr = snapsByStudent.get(s.studentId) ?? [];
    arr.push(s as SnapRow);
    snapsByStudent.set(s.studentId, arr);
  }

  // ── 5. Build per-subject, per-class statistics ────────────────────────────
  type StudentRow = {
    studentId: string;
    name: string;
    ppFlag: boolean;
    sendFlag: boolean;
    score: number | null;
    displayScore: string;
    // pastoral
    attendancePct: number | null;
    latenessCount: number | null;
    detentionsCount: number | null;
    onCallsCount: number | null;
    positivePointsTotal: number | null;
    hasSnapshot: boolean;
  };

  type ClassStat = {
    teacherId: string;
    teacherName: string;
    teacherEmail: string;
    count: number;
    mean: number | null;
    meanDisplay: string | null;
    vsYearMean: number | null;
    // PP gap (scaled to grade unit, positive = PP below non-PP)
    ppCount: number;
    ppMean: number | null;
    ppMeanDisplay: string | null;
    nonPpMean: number | null;
    nonPpMeanDisplay: string | null;
    ppGap: number | null;
    // SEND gap
    sendCount: number;
    sendMean: number | null;
    sendMeanDisplay: string | null;
    nonSendMean: number | null;
    sendGap: number | null;
    // pastoral
    meanAttendancePct: number | null;
    meanDetentionsCount: number | null;
    meanOnCallsCount: number | null;
    below90Count: number;
    // observations
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

    const allScores = asmt.results
      .map((r) => r.normalizedScore)
      .filter((s): s is number => s !== null);
    const yearMeanVal = avg(allScores);

    const teacherStudents = new Map<string, StudentRow[]>();
    const unassigned: StudentRow[] = [];

    for (const r of asmt.results) {
      const teacherId = subjectId
        ? (studentSubjectTeacher.get(r.studentId)?.get(subjectId) ?? null)
        : null;

      const snap = closestSnapshot(snapsByStudent.get(r.studentId) ?? [], assessedAt);

      const sRow: StudentRow = {
        studentId: r.studentId,
        name: r.student.fullName,
        ppFlag: r.student.ppFlag,
        sendFlag: r.student.sendFlag,
        score: r.normalizedScore,
        displayScore: r.normalizedScore !== null
          ? displayScore(r.normalizedScore, asmt.gradeFormat)
          : r.rawValue,
        attendancePct: snap ? Math.round(Number(snap.attendancePct) * 10) / 10 : null,
        latenessCount: snap?.latenessCount ?? null,
        detentionsCount: snap?.detentionsCount ?? null,
        onCallsCount: snap?.onCallsCount ?? null,
        positivePointsTotal: snap?.positivePointsTotal ?? null,
        hasSnapshot: snap !== null,
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
      const teacherName = teacher ? teacher.fullName || teacher.email : "Unknown Teacher";

      // Attainment
      const scores = students.map((s) => s.score).filter((s): s is number => s !== null);
      const classMean = avg(scores);
      const vsYear = classMean !== null && yearMeanVal !== null ? classMean - yearMeanVal : null;

      // PP gap
      const ppStudents = students.filter((s) => s.ppFlag);
      const nonPpStudents = students.filter((s) => !s.ppFlag);
      const ppScores = ppStudents.map((s) => s.score).filter((s): s is number => s !== null);
      const nonPpScores = nonPpStudents.map((s) => s.score).filter((s): s is number => s !== null);
      const ppMeanVal = avg(ppScores);
      const nonPpMeanVal = avg(nonPpScores);
      const ppGapNorm = ppMeanVal !== null && nonPpMeanVal !== null ? nonPpMeanVal - ppMeanVal : null;

      // SEND gap
      const sendStudents = students.filter((s) => s.sendFlag);
      const nonSendStudents = students.filter((s) => !s.sendFlag);
      const sendScores = sendStudents.map((s) => s.score).filter((s): s is number => s !== null);
      const nonSendScores = nonSendStudents.map((s) => s.score).filter((s): s is number => s !== null);
      const sendMeanVal = avg(sendScores);
      const nonSendMeanVal = avg(nonSendScores);
      const sendGapNorm = sendMeanVal !== null && nonSendMeanVal !== null ? nonSendMeanVal - sendMeanVal : null;

      // Pastoral
      const snapped = students.filter((s) => s.hasSnapshot);
      const attendVals = snapped.map((s) => s.attendancePct).filter((v): v is number => v !== null);
      const detVals = snapped.map((s) => s.detentionsCount).filter((v): v is number => v !== null);
      const onCallVals = snapped.map((s) => s.onCallsCount).filter((v): v is number => v !== null);
      const below90Count = attendVals.filter((v) => v < 90).length;

      // Observations
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
        vsYearMean: vsYear !== null ? scaleVsYear(vsYear, asmt.gradeFormat) : null,
        // PP
        ppCount: ppStudents.length,
        ppMean: ppMeanVal,
        ppMeanDisplay: ppMeanVal !== null ? displayScore(ppMeanVal, asmt.gradeFormat) : null,
        nonPpMean: nonPpMeanVal,
        nonPpMeanDisplay: nonPpMeanVal !== null ? displayScore(nonPpMeanVal, asmt.gradeFormat) : null,
        ppGap: ppGapNorm !== null ? scaleVsYear(ppGapNorm, asmt.gradeFormat) : null,
        // SEND
        sendCount: sendStudents.length,
        sendMean: sendMeanVal,
        sendMeanDisplay: sendMeanVal !== null ? displayScore(sendMeanVal, asmt.gradeFormat) : null,
        nonSendMean: nonSendMeanVal,
        sendGap: sendGapNorm !== null ? scaleVsYear(sendGapNorm, asmt.gradeFormat) : null,
        // Pastoral
        meanAttendancePct: round1(avg(attendVals)),
        meanDetentionsCount: round1(avg(detVals)),
        meanOnCallsCount: round1(avg(onCallVals)),
        below90Count,
        // Observations
        observationCount: obsCount,
        topSignals,
        students: students.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)),
      });
    }

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
}
