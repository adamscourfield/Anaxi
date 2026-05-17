/**
 * Behaviour Depth Analysis
 *
 * Extends the base behaviour analysis with: on-call location breakdown,
 * day-of-week patterns, repeat-student identification, and a
 * reason × year-group matrix — all derived from raw OnCallRequest records
 * rather than the periodic StudentSnapshot.
 */

import { prisma } from "@/lib/prisma";
import type { RiskBand } from "@/modules/analysis/studentRisk";

// ─── Constants ────────────────────────────────────────────────────────────────

const REPEAT_THRESHOLD = 3;

// ─── Types ────────────────────────────────────────────────────────────────────

export type OnCallLocationRow = {
  location: string;
  count: number;
  pct: number;
  topYearGroups: string[];
};

export type DayOfWeekRow = {
  dayIndex: number;
  dayLabel: string;
  count: number;
  pct: number;
};

export type RepeatStudentRow = {
  studentId: string;
  studentName: string;
  yearGroup: string | null;
  sendFlag: boolean;
  ppFlag: boolean;
  onCallCount: number;
  topReasons: string[];
  band: RiskBand | null;
};

export type ReasonYearGroupCell = {
  yearGroup: string;
  reason: string;
  count: number;
};

export type BehaviourDepthResult = {
  windowDays: number;
  totalOnCalls: number;
  locationBreakdown: OnCallLocationRow[];
  dayOfWeekPattern: DayOfWeekRow[];
  repeatStudents: RepeatStudentRow[];
  reasonYearGroupMatrix: ReasonYearGroupCell[];
  computedAt: Date;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function windowStart(windowDays: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - windowDays);
  return d;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function computeBehaviourDepth(
  tenantId: string,
  windowDays: number,
): Promise<BehaviourDepthResult> {
  const since = windowStart(windowDays);

  // Load on-call requests with student data
  const requests = await (prisma as any).onCallRequest.findMany({
    where: {
      tenantId,
      createdAt: { gte: since },
      requestType: "BEHAVIOUR",
    },
    select: {
      id: true,
      createdAt: true,
      location: true,
      behaviourReasonCategory: true,
      studentId: true,
      student: {
        select: {
          id: true,
          fullName: true,
          yearGroup: true,
          sendFlag: true,
          ppFlag: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const total = (requests as any[]).length;
  if (total === 0) {
    return {
      windowDays,
      totalOnCalls: 0,
      locationBreakdown: [],
      dayOfWeekPattern: DAY_LABELS.map((dayLabel, dayIndex) => ({
        dayIndex,
        dayLabel,
        count: 0,
        pct: 0,
      })),
      repeatStudents: [],
      reasonYearGroupMatrix: [],
      computedAt: new Date(),
    };
  }

  // ── Location breakdown ────────────────────────────────────────────────────

  const locationCounts = new Map<string, { count: number; yearGroups: Map<string, number> }>();
  for (const r of requests as any[]) {
    const loc: string = r.location ?? "Unknown";
    if (!locationCounts.has(loc)) {
      locationCounts.set(loc, { count: 0, yearGroups: new Map() });
    }
    const entry = locationCounts.get(loc)!;
    entry.count++;
    const yg: string = r.student?.yearGroup ?? "Unknown";
    entry.yearGroups.set(yg, (entry.yearGroups.get(yg) ?? 0) + 1);
  }

  const locationBreakdown: OnCallLocationRow[] = Array.from(
    locationCounts.entries(),
  )
    .sort((a, b) => b[1].count - a[1].count)
    .map(([location, { count, yearGroups }]) => {
      const topYearGroups = Array.from(yearGroups.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([yg]) => yg);
      return { location, count, pct: count / total, topYearGroups };
    });

  // ── Day-of-week pattern ───────────────────────────────────────────────────

  const dayCounts = new Array(7).fill(0);
  for (const r of requests as any[]) {
    dayCounts[new Date(r.createdAt).getDay()]++;
  }
  const dayOfWeekPattern: DayOfWeekRow[] = DAY_LABELS.map((dayLabel, dayIndex) => ({
    dayIndex,
    dayLabel,
    count: dayCounts[dayIndex],
    pct: dayCounts[dayIndex] / total,
  }));

  // ── Repeat students ───────────────────────────────────────────────────────

  const studentOnCalls = new Map<
    string,
    { student: any; reasons: Map<string, number>; count: number }
  >();
  for (const r of requests as any[]) {
    const sid: string = r.studentId;
    if (!studentOnCalls.has(sid)) {
      studentOnCalls.set(sid, {
        student: r.student,
        reasons: new Map(),
        count: 0,
      });
    }
    const entry = studentOnCalls.get(sid)!;
    entry.count++;
    const reason: string = r.behaviourReasonCategory ?? "Uncategorised";
    entry.reasons.set(reason, (entry.reasons.get(reason) ?? 0) + 1);
  }

  // Load risk bands for repeat students
  const repeatCandidateIds = Array.from(studentOnCalls.entries())
    .filter(([, e]) => e.count >= REPEAT_THRESHOLD)
    .map(([id]) => id);

  const riskSnapshots =
    repeatCandidateIds.length > 0
      ? await (prisma as any).studentSnapshot.findMany({
          where: {
            tenantId,
            studentId: { in: repeatCandidateIds },
            snapshotDate: { gte: since },
          },
          orderBy: { snapshotDate: "desc" },
          select: { studentId: true, onCallsCount: true, attendancePct: true },
        })
      : [];

  // Simplified band derivation from on-call count
  const bandByStudent = new Map<string, RiskBand>();
  for (const snap of riskSnapshots as any[]) {
    if (!bandByStudent.has(snap.studentId)) {
      const count: number = snap.onCallsCount ?? 0;
      let band: RiskBand = "STABLE";
      if (count >= 6) band = "URGENT";
      else if (count >= 3) band = "PRIORITY";
      else if (count >= 1) band = "WATCH";
      bandByStudent.set(snap.studentId, band);
    }
  }

  const repeatStudents: RepeatStudentRow[] = Array.from(studentOnCalls.entries())
    .filter(([, e]) => e.count >= REPEAT_THRESHOLD)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([id, { student, reasons, count }]) => ({
      studentId: id,
      studentName: student?.fullName ?? "Unknown",
      yearGroup: student?.yearGroup ?? null,
      sendFlag: student?.sendFlag ?? false,
      ppFlag: student?.ppFlag ?? false,
      onCallCount: count,
      topReasons: Array.from(reasons.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([r]) => r),
      band: bandByStudent.get(id) ?? null,
    }));

  // ── Reason × year-group matrix ────────────────────────────────────────────

  const matrixCounts = new Map<string, Map<string, number>>();
  for (const r of requests as any[]) {
    const yg: string = r.student?.yearGroup ?? "Unknown";
    const reason: string = r.behaviourReasonCategory ?? "Uncategorised";
    if (!matrixCounts.has(yg)) matrixCounts.set(yg, new Map());
    const reasonMap = matrixCounts.get(yg)!;
    reasonMap.set(reason, (reasonMap.get(reason) ?? 0) + 1);
  }

  const reasonYearGroupMatrix: ReasonYearGroupCell[] = [];
  for (const [yearGroup, reasonMap] of matrixCounts) {
    for (const [reason, count] of reasonMap) {
      reasonYearGroupMatrix.push({ yearGroup, reason, count });
    }
  }
  reasonYearGroupMatrix.sort((a, b) => b.count - a.count);

  return {
    windowDays,
    totalOnCalls: total,
    locationBreakdown,
    dayOfWeekPattern,
    repeatStudents,
    reasonYearGroupMatrix,
    computedAt: new Date(),
  };
}
