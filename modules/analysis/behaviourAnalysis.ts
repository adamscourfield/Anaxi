/**
 * Behaviour Analysis — Explorer
 *
 * Aggregates behaviour, attendance, on-call, and watchlist data
 * for the Analysis page. Supports filtering by year group, PP, and SEND.
 */

import { prisma } from "@/lib/prisma";

// ─── Types ────────────────────────────────────────────────────────────────────

export type BehaviourAnalysisFilters = {
  yearGroup?: string;
  ppOnly?: boolean;
  sendOnly?: boolean;
};

export type OnCallByHourRow = { hour: number; count: number };
export type OnCallByTeacherRow = {
  teacherId: string;
  teacherName: string;
  count: number;
};
export type OnCallByReasonRow = { reason: string; count: number };

export type HighPriorityStudentRow = {
  studentId: string;
  studentName: string;
  yearGroup: string | null;
  ppFlag: boolean;
  sendFlag: boolean;
  attendancePct: number | null;
  detentionsCount: number;
  onCallsCount: number;
  positivePointsTotal: number;
  negativePointsTotal: number;
};

export type BehaviourAnalysisSummary = {
  totalStudents: number;
  attendanceMean: number | null;
  totalPositivePoints: number;
  totalNegativePoints: number;
  hasNegativePoints: boolean;
  totalDetentions: number;
  totalInternalExclusions: number;
  totalSuspensions: number;
  totalOnCalls: number;
  highPriorityCount: number;
};

export type BehaviourAnalysisResult = {
  summary: BehaviourAnalysisSummary;
  onCallByHour: OnCallByHourRow[];
  onCallByTeacher: OnCallByTeacherRow[];
  onCallByReason: OnCallByReasonRow[];
  highPriorityStudents: HighPriorityStudentRow[];
  computedAt: Date;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function windowBounds(windowDays: number): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date(end.getTime() - windowDays * 24 * 60 * 60 * 1000);
  return { start, end };
}

/** Bucket an hour (0-23) for display. Returns all school hours 7-17. */
export function bucketOnCallsByHour(
  requests: { createdAt: Date }[],
): OnCallByHourRow[] {
  const counts = new Map<number, number>();
  for (let h = 7; h <= 17; h++) counts.set(h, 0);

  for (const req of requests) {
    const hour = req.createdAt.getHours();
    counts.set(hour, (counts.get(hour) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([hour, count]) => ({ hour, count }));
}

/** Group on-call requests by requester (teacher). */
export function groupByTeacher(
  requests: { requesterUserId: string; requester: { id: string; fullName: string } }[],
): OnCallByTeacherRow[] {
  const map = new Map<string, { teacherId: string; teacherName: string; count: number }>();

  for (const req of requests) {
    const key = req.requesterUserId;
    const existing = map.get(key);
    if (existing) {
      existing.count++;
    } else {
      map.set(key, {
        teacherId: req.requester.id,
        teacherName: req.requester.fullName,
        count: 1,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

/** Group on-call requests by behaviour reason category. */
export function groupByReason(
  requests: { behaviourReasonCategory: string | null }[],
): OnCallByReasonRow[] {
  const map = new Map<string, number>();

  for (const req of requests) {
    const reason = req.behaviourReasonCategory ?? "Uncategorised";
    map.set(reason, (map.get(reason) ?? 0) + 1);
  }

  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([reason, count]) => ({ reason, count }));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function computeBehaviourAnalysis(
  tenantId: string,
  windowDays: number,
  filters: BehaviourAnalysisFilters = {},
): Promise<BehaviourAnalysisResult> {
  const { start, end } = windowBounds(windowDays);

  // Build student filter
  const studentWhere: Record<string, unknown> = {
    tenantId,
    status: "ACTIVE",
  };
  if (filters.yearGroup) studentWhere.yearGroup = filters.yearGroup;
  if (filters.ppOnly) studentWhere.ppFlag = true;
  if (filters.sendOnly) studentWhere.sendFlag = true;

  // Fetch students with latest snapshot + watchlist status
  const students = await (prisma as any).student.findMany({
    where: studentWhere,
    include: {
      snapshots: {
        where: { snapshotDate: { gte: start, lte: end } },
        orderBy: { snapshotDate: "desc" },
        take: 1,
      },
      watchlistEntries: {
        where: { tenantId },
        take: 1,
      },
    },
  });

  // Fetch on-call requests in window for matching students
  const studentIds = (students as any[]).map((s: any) => s.id);

  const onCallRequests = await (prisma as any).onCallRequest.findMany({
    where: {
      tenantId,
      createdAt: { gte: start, lte: end },
      ...(studentIds.length > 0 ? { studentId: { in: studentIds } } : {}),
    },
    include: {
      requester: { select: { id: true, fullName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Aggregate snapshot data
  let totalPositivePoints = 0;
  let totalNegativePoints = 0;
  let totalDetentions = 0;
  let totalInternalExclusions = 0;
  let totalSuspensions = 0;
  let totalOnCalls = 0;
  let hasNegativePoints = false;
  const attendanceValues: number[] = [];

  const watchlistStudentIds = new Set<string>();
  const highPriorityStudents: HighPriorityStudentRow[] = [];

  for (const student of students as any[]) {
    const snap = student.snapshots?.[0];
    const isOnWatchlist = (student.watchlistEntries?.length ?? 0) > 0;

    if (isOnWatchlist) watchlistStudentIds.add(student.id);

    if (snap) {
      totalPositivePoints += snap.positivePointsTotal as number;
      totalNegativePoints += snap.negativePointsTotal as number;
      totalDetentions += snap.detentionsCount as number;
      totalInternalExclusions += snap.internalExclusionsCount as number;
      totalSuspensions += snap.suspensionsCount as number;
      totalOnCalls += snap.onCallsCount as number;
      attendanceValues.push(Number(snap.attendancePct));

      if ((snap.negativePointsTotal as number) > 0) {
        hasNegativePoints = true;
      }
    }

    if (isOnWatchlist) {
      highPriorityStudents.push({
        studentId: student.id,
        studentName: student.fullName,
        yearGroup: student.yearGroup,
        ppFlag: student.ppFlag,
        sendFlag: student.sendFlag,
        attendancePct: snap ? Number(snap.attendancePct) : null,
        detentionsCount: snap ? (snap.detentionsCount as number) : 0,
        onCallsCount: snap ? (snap.onCallsCount as number) : 0,
        positivePointsTotal: snap ? (snap.positivePointsTotal as number) : 0,
        negativePointsTotal: snap ? (snap.negativePointsTotal as number) : 0,
      });
    }
  }

  const attendanceMean =
    attendanceValues.length > 0
      ? attendanceValues.reduce((a, b) => a + b, 0) / attendanceValues.length
      : null;

  // On-call breakdowns
  const onCallByHour = bucketOnCallsByHour(onCallRequests as any[]);
  const onCallByTeacher = groupByTeacher(onCallRequests as any[]);
  const onCallByReason = groupByReason(onCallRequests as any[]);

  return {
    summary: {
      totalStudents: (students as any[]).length,
      attendanceMean,
      totalPositivePoints,
      totalNegativePoints,
      hasNegativePoints,
      totalDetentions,
      totalInternalExclusions,
      totalSuspensions,
      totalOnCalls,
      highPriorityCount: watchlistStudentIds.size,
    },
    onCallByHour,
    onCallByTeacher,
    onCallByReason,
    highPriorityStudents,
    computedAt: new Date(),
  };
}
