/**
 * LOA Impact Analysis
 *
 * For each teacher who had approved leave in the analysis window, identifies
 * the students in their classes (via StudentSubjectTeacher) and compares
 * those students' current risk-band distribution against the school average.
 * Also surfaces the raw absence days for context.
 *
 * Limitation: StudentSnapshot is periodic (term-to-date), so we cannot
 * isolate metrics precisely to the absence window. Instead we compare
 * "teacher's current students" vs "school average" and flag cohorts that
 * deviate meaningfully.
 */

import { prisma } from "@/lib/prisma";
import type { RiskBand } from "@/modules/analysis/studentRisk";
import { BAND_ORDER } from "@/modules/analysis/studentRisk";

// ─── Types ────────────────────────────────────────────────────────────────────

export type LOATeacherAbsence = {
  teacherId: string;
  teacherName: string;
  startDate: Date;
  endDate: Date;
  daysAbsent: number;
  reasonLabel: string | null;
  status: string;
};

export type LOAStudentImpactRow = {
  teacherId: string;
  teacherName: string;
  totalDaysAbsent: number;
  absences: LOATeacherAbsence[];
  affectedStudentCount: number;
  subjects: string[];
  bandDistribution: Record<RiskBand, number>;
  urgentPriorityPct: number;
  schoolUrgentPriorityPct: number;
  deviation: number | null;
  confidence: "HIGH" | "LOW";
};

export type LOAImpactResult = {
  windowDays: number;
  teacherRows: LOAStudentImpactRow[];
  schoolUrgentPriorityPct: number;
  computedAt: Date;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysBetween(a: Date, b: Date): number {
  return Math.max(
    1,
    Math.ceil(Math.abs(b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)),
  );
}

function windowStart(windowDays: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - windowDays);
  return d;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function computeLOAImpact(
  tenantId: string,
  windowDays: number,
): Promise<LOAImpactResult> {
  const since = windowStart(windowDays);
  const now = new Date();

  const empty: LOAImpactResult = {
    windowDays,
    teacherRows: [],
    schoolUrgentPriorityPct: 0,
    computedAt: now,
  };

  // ── 1. Approved LOA requests in the window ──────────────────────────────

  const loaRequests = await (prisma as any).lOARequest.findMany({
    where: {
      tenantId,
      status: "APPROVED",
      startDate: { lte: now },
      endDate: { gte: since },
    },
    include: {
      requester: { select: { id: true, fullName: true } },
      reason: { select: { label: true } },
    },
  });

  if ((loaRequests as any[]).length === 0) return empty;

  // ── 2. School-wide student risk snapshot ──────────────────────────────────

  const allStudents = await (prisma as any).student.findMany({
    where: { tenantId, status: "ACTIVE" },
    include: {
      snapshots: {
        where: { snapshotDate: { gte: since } },
        orderBy: { snapshotDate: "desc" },
        take: 1,
        select: { onCallsCount: true, attendancePct: true, detentionsCount: true },
      },
    },
    select: {
      id: true,
      snapshots: true,
    },
  });

  function snapToBand(onCalls: number, attendance: number): RiskBand {
    if (onCalls >= 3 || attendance < 80) return "URGENT";
    if (onCalls >= 1 || attendance < 90) return "PRIORITY";
    if (attendance < 95) return "WATCH";
    return "STABLE";
  }

  let schoolUrgentPriority = 0;
  const schoolTotal = (allStudents as any[]).length;
  const studentBandMap = new Map<string, RiskBand>();

  for (const s of allStudents as any[]) {
    const snap = s.snapshots?.[0];
    if (!snap) {
      studentBandMap.set(s.id, "STABLE");
      continue;
    }
    const band = snapToBand(snap.onCallsCount ?? 0, Number(snap.attendancePct ?? 100));
    studentBandMap.set(s.id, band);
    if (band === "URGENT" || band === "PRIORITY") schoolUrgentPriority++;
  }

  const schoolUrgentPriorityPct =
    schoolTotal > 0 ? schoolUrgentPriority / schoolTotal : 0;

  // ── 3. Group LOA by teacher ────────────────────────────────────────────────

  const absencesByTeacher = new Map<string, { teacher: any; absences: any[] }>();
  for (const req of loaRequests as any[]) {
    const tid: string = req.requesterId;
    if (!absencesByTeacher.has(tid)) {
      absencesByTeacher.set(tid, { teacher: req.requester, absences: [] });
    }
    absencesByTeacher.get(tid)!.absences.push(req);
  }

  const teacherIds = Array.from(absencesByTeacher.keys());

  // ── 4. Students taught by these teachers ──────────────────────────────────

  const subjectTeachers = await (prisma as any).studentSubjectTeacher.findMany({
    where: {
      tenantId,
      teacherId: { in: teacherIds },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: since } }],
    },
    include: {
      subject: { select: { name: true } },
      student: { select: { id: true } },
    },
  });

  // Group: teacherId → { studentIds: Set, subjects: Set }
  type TeacherStudentData = {
    studentIds: Set<string>;
    subjects: Set<string>;
  };
  const teacherStudents = new Map<string, TeacherStudentData>();
  for (const st of subjectTeachers as any[]) {
    const tid: string = st.teacherId;
    if (!teacherStudents.has(tid)) {
      teacherStudents.set(tid, { studentIds: new Set(), subjects: new Set() });
    }
    const entry = teacherStudents.get(tid)!;
    entry.studentIds.add(st.studentId);
    if (st.subject?.name) entry.subjects.add(st.subject.name);
  }

  // ── 5. Build impact rows ───────────────────────────────────────────────────

  const teacherRows: LOAStudentImpactRow[] = [];

  for (const [teacherId, { teacher, absences }] of absencesByTeacher) {
    const tsd = teacherStudents.get(teacherId);
    const affectedStudentCount = tsd?.studentIds.size ?? 0;
    const subjects = tsd ? Array.from(tsd.subjects).sort() : [];

    const totalDaysAbsent = absences.reduce((sum: number, req: any) => {
      return sum + daysBetween(new Date(req.startDate), new Date(req.endDate));
    }, 0);

    const bandDist: Record<RiskBand, number> = {
      URGENT: 0,
      PRIORITY: 0,
      WATCH: 0,
      STABLE: 0,
    };
    let urgentPriorityCount = 0;

    if (tsd) {
      for (const sid of tsd.studentIds) {
        const band = studentBandMap.get(sid) ?? "STABLE";
        bandDist[band]++;
        if (band === "URGENT" || band === "PRIORITY") urgentPriorityCount++;
      }
    }

    const urgentPriorityPct =
      affectedStudentCount > 0 ? urgentPriorityCount / affectedStudentCount : 0;
    const deviation =
      affectedStudentCount >= 5
        ? urgentPriorityPct - schoolUrgentPriorityPct
        : null;

    teacherRows.push({
      teacherId,
      teacherName: teacher?.fullName ?? "Unknown",
      totalDaysAbsent,
      absences: absences.map((req: any) => ({
        teacherId,
        teacherName: teacher?.fullName ?? "Unknown",
        startDate: new Date(req.startDate),
        endDate: new Date(req.endDate),
        daysAbsent: daysBetween(new Date(req.startDate), new Date(req.endDate)),
        reasonLabel: req.reason?.label ?? null,
        status: req.status,
      })),
      affectedStudentCount,
      subjects,
      bandDistribution: bandDist,
      urgentPriorityPct,
      schoolUrgentPriorityPct,
      deviation,
      confidence: affectedStudentCount >= 5 ? "HIGH" : "LOW",
    });
  }

  // Sort: largest positive deviation (above school average) first
  teacherRows.sort((a, b) => {
    const da = a.deviation ?? -Infinity;
    const db = b.deviation ?? -Infinity;
    return db - da;
  });

  return {
    windowDays,
    teacherRows,
    schoolUrgentPriorityPct,
    computedAt: now,
  };
}
