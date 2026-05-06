/**
 * Behaviour Analysis — Explorer
 *
 * Aggregates behaviour, attendance, on-call, and pastoral risk data
 * for the Analysis page. Supports filtering by year group, PP, and SEND.
 */

import { prisma } from "@/lib/prisma";
import { computeStudentRiskIndex, type RiskBand } from "@/modules/analysis/studentRisk";

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
  band: RiskBand;
  attendancePct: number | null;
  detentionsCount: number;
  internalExclusionsCount: number;
  onCallsCount: number;
  positivePointsTotal: number;
  negativePointsTotal: number;
};

export type BehaviourAnalysisSummary = {
  totalStudents: number;
  attendanceMean: number | null;
  totalPositivePoints: number;
  totalNegativePoints: number;
  hasPositivePoints: boolean;
  hasNegativePoints: boolean;
  totalDetentions: number;
  totalInternalExclusions: number;
  totalSuspensions: number;
  totalOnCalls: number;
  highPriorityCount: number;
};

/** One row per student with at least one suspension on their latest in-window snapshot. */
export type SuspensionIncidentRow = {
  studentId: string;
  studentName: string;
  yearGroup: string | null;
  suspensionsCount: number;
  snapshotDate: Date;
};

/** Serializable on-call row for client charts / popovers. */
export type OnCallRequestDetail = {
  id: string;
  createdAt: string;
  studentId: string;
  studentName: string;
  studentYearGroup: string | null;
  requesterName: string;
  behaviourReasonCategory: string | null;
  status: string;
  location: string;
  notes: string | null;
};

/** Per-calendar-day cohort totals (sum across snapshots on that day) for trend sparklines. */
export type BehaviourCohortDailyMetricRow = {
  day: string;
  detentions: number;
  internalExclusions: number;
  suspensions: number;
  positivePoints: number;
  negativePoints: number;
};

export type BehaviourAnalysisResult = {
  summary: BehaviourAnalysisSummary;
  /** One row per day in the analysis window (zeros when no snapshots). */
  cohortDailyMetrics: BehaviourCohortDailyMetricRow[];
  onCallByHour: OnCallByHourRow[];
  onCallByTeacher: OnCallByTeacherRow[];
  onCallByReason: OnCallByReasonRow[];
  onCallRequestDetails: OnCallRequestDetail[];
  suspensionIncidents: SuspensionIncidentRow[];
  highPriorityStudents: HighPriorityStudentRow[];
  computedAt: Date;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function windowBounds(windowDays: number): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date(end.getTime() - windowDays * 24 * 60 * 60 * 1000);
  return { start, end };
}

/**
 * Bucket on-call requests by clock hour for the school day (8:00–15:59 → 8am–3pm).
 * Requests outside that range are omitted from buckets.
 */
export function bucketOnCallsByHour(
  requests: { createdAt: Date }[],
): OnCallByHourRow[] {
  const counts = new Map<number, number>();
  for (let h = 8; h <= 15; h++) counts.set(h, 0);

  for (const req of requests) {
    const hour = req.createdAt.getHours();
    if (hour < 8 || hour > 15) continue;
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

function dayKeyUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Enumerate each calendar day from `start` through `end` (inclusive, local date). */
function eachDayInRange(start: Date, end: Date): string[] {
  const out: string[] = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (cur <= last) {
    out.push(dayKeyUtc(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/**
 * Sum snapshot discipline/points fields by calendar day for students matching `studentWhere`.
 */
async function computeCohortDailyMetrics(
  tenantId: string,
  start: Date,
  end: Date,
  studentWhere: Record<string, unknown>,
): Promise<BehaviourCohortDailyMetricRow[]> {
  const rows = await (prisma as any).studentSnapshot.findMany({
    where: {
      tenantId,
      snapshotDate: { gte: start, lte: end },
      student: studentWhere,
    },
    select: {
      snapshotDate: true,
      detentionsCount: true,
      internalExclusionsCount: true,
      suspensionsCount: true,
      positivePointsTotal: true,
      negativePointsTotal: true,
    },
  });

  type Agg = {
    detentions: number;
    internalExclusions: number;
    suspensions: number;
    positivePoints: number;
    negativePoints: number;
  };
  const byDay = new Map<string, Agg>();

  for (const r of rows as any[]) {
    const k = dayKeyUtc(r.snapshotDate as Date);
    const prev = byDay.get(k) ?? {
      detentions: 0,
      internalExclusions: 0,
      suspensions: 0,
      positivePoints: 0,
      negativePoints: 0,
    };
    prev.detentions += r.detentionsCount as number;
    prev.internalExclusions += r.internalExclusionsCount as number;
    prev.suspensions += r.suspensionsCount as number;
    prev.positivePoints += r.positivePointsTotal as number;
    prev.negativePoints += r.negativePointsTotal as number;
    byDay.set(k, prev);
  }

  const days = eachDayInRange(start, end);
  return days.map((day) => {
    const a = byDay.get(day);
    return {
      day,
      detentions: a?.detentions ?? 0,
      internalExclusions: a?.internalExclusions ?? 0,
      suspensions: a?.suspensions ?? 0,
      positivePoints: a?.positivePoints ?? 0,
      negativePoints: a?.negativePoints ?? 0,
    };
  });
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

export type ComputeBehaviourAnalysisOptions = {
  viewerUserId: string;
  /** When false, live on-call request breakdowns are omitted (snapshot on-call totals still apply). */
  hasOnCallFeature?: boolean;
};

export async function computeBehaviourAnalysis(
  tenantId: string,
  windowDays: number,
  filters: BehaviourAnalysisFilters = {},
  options: ComputeBehaviourAnalysisOptions,
): Promise<BehaviourAnalysisResult> {
  const { viewerUserId, hasOnCallFeature = true } = options;
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
    },
  });

  // Fetch on-call requests in window for matching students
  const studentIds = (students as any[]).map((s: any) => s.id);

  const cohortDailyMetrics = await computeCohortDailyMetrics(tenantId, start, end, studentWhere);

  const onCallRequests =
    hasOnCallFeature && studentIds.length > 0
      ? await (prisma as any).onCallRequest.findMany({
          where: {
            tenantId,
            createdAt: { gte: start, lte: end },
            studentId: { in: studentIds },
          },
          include: {
            requester: { select: { id: true, fullName: true } },
            student: { select: { id: true, fullName: true, yearGroup: true } },
          },
          orderBy: { createdAt: "desc" },
        })
      : [];

  // Aggregate snapshot data
  let totalPositivePoints = 0;
  let totalNegativePoints = 0;
  let totalDetentions = 0;
  let totalInternalExclusions = 0;
  let totalSuspensions = 0;
  let totalOnCalls = 0;
  let hasNegativePoints = false;
  let hasPositivePoints = false;
  const attendanceValues: number[] = [];
  const suspensionIncidents: SuspensionIncidentRow[] = [];

  const snapByStudentId = new Map<string, any>();
  for (const student of students as any[]) {
    const snap = student.snapshots?.[0];
    if (snap) snapByStudentId.set(student.id, snap);
  }

  for (const student of students as any[]) {
    const snap = student.snapshots?.[0];

    if (snap) {
      totalPositivePoints += snap.positivePointsTotal as number;
      totalNegativePoints += snap.negativePointsTotal as number;
      totalDetentions += snap.detentionsCount as number;
      totalInternalExclusions += snap.internalExclusionsCount as number;
      totalSuspensions += snap.suspensionsCount as number;
      totalOnCalls += snap.onCallsCount as number;
      attendanceValues.push(Number(snap.attendancePct));

      if ((snap.suspensionsCount as number) > 0) {
        suspensionIncidents.push({
          studentId: student.id,
          studentName: student.fullName,
          yearGroup: student.yearGroup ?? null,
          suspensionsCount: snap.suspensionsCount as number,
          snapshotDate: snap.snapshotDate as Date,
        });
      }

      if ((snap.positivePointsTotal as number) > 0) {
        hasPositivePoints = true;
      }
      if ((snap.negativePointsTotal as number) > 0) {
        hasNegativePoints = true;
      }
    }
  }

  suspensionIncidents.sort((a, b) => b.suspensionsCount - a.suspensionsCount || b.snapshotDate.getTime() - a.snapshotDate.getTime());

  const { rows: riskRows } = await computeStudentRiskIndex(tenantId, windowDays, viewerUserId);

  const matchesDemographics = (row: {
    yearGroup: string | null;
    ppFlag: boolean;
    sendFlag: boolean;
  }) => {
    if (filters.yearGroup && row.yearGroup !== filters.yearGroup) return false;
    if (filters.ppOnly && !row.ppFlag) return false;
    if (filters.sendOnly && !row.sendFlag) return false;
    return true;
  };

  const highPriorityBands: RiskBand[] = ["URGENT", "PRIORITY"];
  const highPriorityStudents: HighPriorityStudentRow[] = riskRows
    .filter((r) => highPriorityBands.includes(r.band) && matchesDemographics(r))
    .map((r) => {
      const snap = snapByStudentId.get(r.studentId);
      return {
        studentId: r.studentId,
        studentName: r.studentName,
        yearGroup: r.yearGroup,
        ppFlag: r.ppFlag,
        sendFlag: r.sendFlag,
        band: r.band,
        attendancePct: r.attendancePct,
        detentionsCount: snap ? (snap.detentionsCount as number) : 0,
        internalExclusionsCount: snap ? (snap.internalExclusionsCount as number) : 0,
        onCallsCount: snap ? (snap.onCallsCount as number) : 0,
        positivePointsTotal: snap ? (snap.positivePointsTotal as number) : (r.positivePointsTotal ?? 0),
        negativePointsTotal: snap ? (snap.negativePointsTotal as number) : 0,
      };
    });

  const attendanceMean =
    attendanceValues.length > 0
      ? attendanceValues.reduce((a, b) => a + b, 0) / attendanceValues.length
      : null;

  // On-call breakdowns
  const onCallByHour = bucketOnCallsByHour(onCallRequests as any[]);
  const onCallByTeacher = groupByTeacher(onCallRequests as any[]);
  const onCallByReason = groupByReason(onCallRequests as any[]);

  const onCallRequestDetails: OnCallRequestDetail[] = (onCallRequests as any[]).map((r: any) => ({
    id: r.id as string,
    createdAt: (r.createdAt as Date).toISOString(),
    studentId: r.studentId as string,
    studentName: (r.student?.fullName as string) ?? "—",
    studentYearGroup: (r.student?.yearGroup as string | null) ?? null,
    requesterName: (r.requester?.fullName as string) ?? "—",
    behaviourReasonCategory: (r.behaviourReasonCategory as string | null) ?? null,
    status: r.status as string,
    location: r.location as string,
    notes: (r.notes as string | null) ?? null,
  }));

  return {
    summary: {
      totalStudents: (students as any[]).length,
      attendanceMean,
      totalPositivePoints,
      totalNegativePoints,
      hasPositivePoints,
      hasNegativePoints,
      totalDetentions,
      totalInternalExclusions,
      totalSuspensions,
      totalOnCalls,
      highPriorityCount: highPriorityStudents.length,
    },
    cohortDailyMetrics,
    onCallByHour,
    onCallByTeacher,
    onCallByReason,
    onCallRequestDetails,
    suspensionIncidents,
    highPriorityStudents,
    computedAt: new Date(),
  };
}
