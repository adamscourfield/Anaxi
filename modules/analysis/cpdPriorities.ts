/**
 * CPD Priority Ranking — Phase 1B
 *
 * Identifies which instructional signals are most commonly weakening across
 * teachers, using the same window + coverage guardrails as TRI.
 *
 * No judgement language. Coverage transparency everywhere.
 */

import { prisma } from "@/lib/prisma";
import { SIGNAL_DEFINITIONS } from "@/modules/observations/signalDefinitions";

// ─── Constants ────────────────────────────────────────────────────────────────

const SCALE_SCORES: Record<string, number> = {
  LIMITED: 1,
  SOME: 2,
  CONSISTENT: 3,
  STRONG: 4,
};

const DEFAULT_MIN_COVERAGE = 6;
const DEFAULT_DRIFT_THRESHOLD = 0.35;
const MINIMUM_SCHOOL_COVERAGE_THRESHOLD = 5;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const ALL_SIGNAL_KEYS = SIGNAL_DEFINITIONS.map((s) => s.key);

// ─── Types ────────────────────────────────────────────────────────────────────

export type OptionalFilters = {
  departmentId?: string;
};

export type CpdPriorityRow = {
  signalKey: string;
  label: string;
  teachersCovered: number;
  teachersDriftingDown: number;
  driftRate: number;
  avgNegativeDelta: number | null;
  avgNegDeltaAbs: number | null;
  priorityScore: number;
  teachersImproving: number;
  improvingRate: number;
  avgPositiveDelta: number | null;
  priorityImprovementScore: number;
};

export type AffectedTeacherRow = {
  teacherMembershipId: string;
  teacherName: string;
  deptNames: string[];
  teacherCoverage: number;
  currentMean: number | null;
  prevMean: number | null;
  delta: number | null;
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

function windowBounds(windowDays: number): {
  currentStart: Date;
  currentEnd: Date;
  prevStart: Date;
  prevEnd: Date;
} {
  const now = new Date();
  const currentEnd = now;
  const currentStart = new Date(now.getTime() - windowDays * MS_PER_DAY);
  const prevEnd = currentStart;
  const prevStart = new Date(currentStart.getTime() - windowDays * MS_PER_DAY);
  return { currentStart, currentEnd, prevStart, prevEnd };
}

function computeMean(scores: number[]): number | null {
  if (scores.length === 0) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

type SignalMeans = Map<string, { scores: number[]; count: number }>;

function buildSignalMeans(
  signals: { signalKey: string; valueKey: string | null; notObserved: boolean }[]
): SignalMeans {
  const map: SignalMeans = new Map();
  for (const sig of signals) {
    if (sig.notObserved || !sig.valueKey) continue;
    const score = SCALE_SCORES[sig.valueKey];
    if (score === undefined) continue;
    if (!map.has(sig.signalKey)) map.set(sig.signalKey, { scores: [], count: 0 });
    const entry = map.get(sig.signalKey)!;
    entry.scores.push(score);
    entry.count++;
  }
  return map;
}

function getSignalLabel(signalKey: string, labelMap: Map<string, string>): string {
  const def = SIGNAL_DEFINITIONS.find((s) => s.key === signalKey);
  return labelMap.get(signalKey) ?? def?.displayNameDefault ?? signalKey;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Compute CPD priorities for a tenant: ranks all defined observation signals by how commonly
 * they are weakening across teachers.
 *
 * Also computes improvement metrics for the "positive momentum" section.
 */
export async function computeCpdPriorities(
  tenantId: string,
  windowDays: number,
  filters?: OptionalFilters
): Promise<CpdPriorityRow[]> {
  const settings = await (prisma as any).tenantSettings.findUnique({ where: { tenantId } });
  const minCoverage: number = settings?.minObservationCount ?? DEFAULT_MIN_COVERAGE;
  const driftThreshold: number = settings?.driftDeltaThreshold ?? DEFAULT_DRIFT_THRESHOLD;

  const { currentStart, currentEnd, prevStart } = windowBounds(windowDays);

  // If filtering by department, find teacher IDs in that department
  let departmentTeacherIds: string[] | undefined;
  if (filters?.departmentId) {
    const memberships = await (prisma as any).departmentMembership.findMany({
      where: { tenantId, departmentId: filters.departmentId },
    });
    departmentTeacherIds = (memberships as any[]).map((m: any) => m.userId);
  }

  const teacherFilter = departmentTeacherIds
    ? { observedTeacherId: { in: departmentTeacherIds } }
    : {};

  const [currentObs, prevObs, signalLabels] = await Promise.all([
    (prisma as any).observation.findMany({
      where: { tenantId, observedAt: { gte: currentStart, lte: currentEnd }, ...teacherFilter },
      include: { signals: true },
    }),
    (prisma as any).observation.findMany({
      where: { tenantId, observedAt: { gte: prevStart, lt: currentStart }, ...teacherFilter },
      include: { signals: true },
    }),
    (prisma as any).tenantSignalLabel.findMany({ where: { tenantId } }),
  ]);

  const labelMap = new Map<string, string>(
    (signalLabels as any[]).map((l: any) => [l.signalKey, l.displayName])
  );

  // Group observations by teacher
  const currentByTeacher = new Map<string, any[]>();
  for (const obs of currentObs as any[]) {
    if (!currentByTeacher.has(obs.observedTeacherId))
      currentByTeacher.set(obs.observedTeacherId, []);
    currentByTeacher.get(obs.observedTeacherId)!.push(obs);
  }

  const prevByTeacher = new Map<string, any[]>();
  for (const obs of prevObs as any[]) {
    if (!prevByTeacher.has(obs.observedTeacherId))
      prevByTeacher.set(obs.observedTeacherId, []);
    prevByTeacher.get(obs.observedTeacherId)!.push(obs);
  }

  // For each signal, collect per-teacher deltas from eligible teachers
  const signalDeltas = new Map<string, number[]>();
  for (const key of ALL_SIGNAL_KEYS) signalDeltas.set(key, []);

  for (const [teacherId, teacherObs] of currentByTeacher.entries()) {
    const teacherCoverage = teacherObs.length;
    if (teacherCoverage < minCoverage) continue; // not eligible

    const currentSignals = teacherObs.flatMap((o: any) => o.signals);
    const prevTeacherObs = prevByTeacher.get(teacherId) ?? [];
    const prevSignals = prevTeacherObs.flatMap((o: any) => o.signals);

    const currentMeans = buildSignalMeans(currentSignals);
    const prevMeans = buildSignalMeans(prevSignals);

    for (const signalKey of ALL_SIGNAL_KEYS) {
      const curr = currentMeans.get(signalKey);
      const prev = prevMeans.get(signalKey);
      const currentMean = curr ? computeMean(curr.scores) : null;
      const prevMean = prev ? computeMean(prev.scores) : null;
      if (currentMean === null || prevMean === null) continue;
      signalDeltas.get(signalKey)!.push(currentMean - prevMean);
    }
  }

  // Build result rows
  const rows: CpdPriorityRow[] = ALL_SIGNAL_KEYS.map((signalKey) => {
    const deltas = signalDeltas.get(signalKey)!;
    const teachersCovered = deltas.length;

    const driftingDeltas = deltas.filter((d) => d < -driftThreshold);
    const improvingDeltas = deltas.filter((d) => d > driftThreshold);

    const teachersDriftingDown = driftingDeltas.length;
    const teachersImproving = improvingDeltas.length;

    const driftRate = teachersCovered > 0 ? teachersDriftingDown / teachersCovered : 0;
    const improvingRate = teachersCovered > 0 ? teachersImproving / teachersCovered : 0;

    const avgNegativeDelta =
      driftingDeltas.length > 0
        ? driftingDeltas.reduce((a, b) => a + b, 0) / driftingDeltas.length
        : null;
    const avgNegDeltaAbs = avgNegativeDelta !== null ? Math.abs(avgNegativeDelta) : null;
    const priorityScore = avgNegDeltaAbs !== null ? driftRate * avgNegDeltaAbs : 0;

    const avgPositiveDelta =
      improvingDeltas.length > 0
        ? improvingDeltas.reduce((a, b) => a + b, 0) / improvingDeltas.length
        : null;
    const priorityImprovementScore =
      avgPositiveDelta !== null ? improvingRate * avgPositiveDelta : 0;

    return {
      signalKey,
      label: getSignalLabel(signalKey, labelMap),
      teachersCovered,
      teachersDriftingDown,
      driftRate,
      avgNegativeDelta,
      avgNegDeltaAbs,
      priorityScore,
      teachersImproving,
      improvingRate,
      avgPositiveDelta,
      priorityImprovementScore,
    };
  });

  // Sort by priorityScore descending
  rows.sort((a, b) => b.priorityScore - a.priorityScore);

  return rows;
}

/**
 * Compute the list of teachers driving drift for a specific signal (drilldown).
 * Returns eligible teachers sorted by most negative delta first.
 */
export async function computeSignalAffectedTeachers(
  tenantId: string,
  signalKey: string,
  windowDays: number,
  filters?: OptionalFilters
): Promise<AffectedTeacherRow[]> {
  const settings = await (prisma as any).tenantSettings.findUnique({ where: { tenantId } });
  const minCoverage: number = settings?.minObservationCount ?? DEFAULT_MIN_COVERAGE;

  const { currentStart, currentEnd, prevStart } = windowBounds(windowDays);

  let departmentTeacherIds: string[] | undefined;
  if (filters?.departmentId) {
    const memberships = await (prisma as any).departmentMembership.findMany({
      where: { tenantId, departmentId: filters.departmentId },
    });
    departmentTeacherIds = (memberships as any[]).map((m: any) => m.userId);
  }

  const teacherFilter = departmentTeacherIds
    ? { observedTeacherId: { in: departmentTeacherIds } }
    : {};

  const [currentObs, prevObs, deptMemberships] = await Promise.all([
    (prisma as any).observation.findMany({
      where: { tenantId, observedAt: { gte: currentStart, lte: currentEnd }, ...teacherFilter },
      include: { signals: true, observedTeacher: true },
    }),
    (prisma as any).observation.findMany({
      where: { tenantId, observedAt: { gte: prevStart, lt: currentStart }, ...teacherFilter },
      include: { signals: true },
    }),
    (prisma as any).departmentMembership.findMany({
      where: { tenantId },
      include: { department: true },
    }),
  ]);

  // Build department name map
  const teacherDepts = new Map<string, string[]>();
  for (const m of deptMemberships as any[]) {
    if (!teacherDepts.has(m.userId)) teacherDepts.set(m.userId, []);
    teacherDepts.get(m.userId)!.push(m.department.name);
  }

  // Group by teacher
  const currentByTeacher = new Map<string, any[]>();
  for (const obs of currentObs as any[]) {
    if (!currentByTeacher.has(obs.observedTeacherId))
      currentByTeacher.set(obs.observedTeacherId, []);
    currentByTeacher.get(obs.observedTeacherId)!.push(obs);
  }

  const prevByTeacher = new Map<string, any[]>();
  for (const obs of prevObs as any[]) {
    if (!prevByTeacher.has(obs.observedTeacherId))
      prevByTeacher.set(obs.observedTeacherId, []);
    prevByTeacher.get(obs.observedTeacherId)!.push(obs);
  }

  const result: AffectedTeacherRow[] = [];

  for (const [teacherId, teacherObs] of currentByTeacher.entries()) {
    const teacher = teacherObs[0]?.observedTeacher;
    if (!teacher) continue;

    const teacherCoverage = teacherObs.length;
    if (teacherCoverage < minCoverage) continue;

    const currentSignals = teacherObs.flatMap((o: any) => o.signals);
    const prevTeacherObs = prevByTeacher.get(teacherId) ?? [];
    const prevSignals = prevTeacherObs.flatMap((o: any) => o.signals);

    const currentMeans = buildSignalMeans(currentSignals);
    const prevMeans = buildSignalMeans(prevSignals);

    const curr = currentMeans.get(signalKey);
    const prev = prevMeans.get(signalKey);
    const currentMean = curr ? computeMean(curr.scores) : null;
    const prevMean = prev ? computeMean(prev.scores) : null;

    const delta =
      currentMean !== null && prevMean !== null ? currentMean - prevMean : null;

    result.push({
      teacherMembershipId: teacherId,
      teacherName: teacher.fullName,
      deptNames: teacherDepts.get(teacherId) ?? [],
      teacherCoverage,
      currentMean,
      prevMean,
      delta,
    });
  }

  // Sort by most negative delta first (null deltas last)
  result.sort((a, b) => {
    if (a.delta === null && b.delta === null) return 0;
    if (a.delta === null) return 1;
    if (b.delta === null) return -1;
    return a.delta - b.delta;
  });

  return result;
}

/**
 * Extract top 3 improving signals for the positive momentum section.
 * Requires teachersCovered >= MINIMUM_SCHOOL_COVERAGE_THRESHOLD and teachersImproving > 0.
 */
export function getTopImprovingSignals(rows: CpdPriorityRow[]): CpdPriorityRow[] {
  return [...rows]
    .filter(
      (r) =>
        r.teachersCovered >= MINIMUM_SCHOOL_COVERAGE_THRESHOLD && r.teachersImproving > 0
    )
    .sort((a, b) => b.priorityImprovementScore - a.priorityImprovementScore)
    .slice(0, 3);
}

// ─── Weekly Drift Trend ──────────────────────────────────────────────────────

export type DailyDriftPoint = {
  dayLabel: string;
  observationCount: number;
  driftCount: number;
  driftScore: number;
};

/**
 * Compute daily drift breakdown for the last 7 calendar days,
 * plus week-over-week drift change percentage.
 */
export async function computeWeeklyDriftTrend(
  tenantId: string,
  filters?: OptionalFilters
): Promise<{ days: DailyDriftPoint[]; weekOverWeekChange: number }> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * MS_PER_DAY);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * MS_PER_DAY);

  let departmentTeacherIds: string[] | undefined;
  if (filters?.departmentId) {
    const memberships = await (prisma as any).departmentMembership.findMany({
      where: { tenantId, departmentId: filters.departmentId },
    });
    departmentTeacherIds = (memberships as any[]).map((m: any) => m.userId);
  }

  const teacherFilter = departmentTeacherIds
    ? { observedTeacherId: { in: departmentTeacherIds } }
    : {};

  const [currentWeekObs, prevWeekObs] = await Promise.all([
    (prisma as any).observation.findMany({
      where: { tenantId, observedAt: { gte: sevenDaysAgo, lte: now }, ...teacherFilter },
      include: { signals: true },
    }),
    (prisma as any).observation.findMany({
      where: { tenantId, observedAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo }, ...teacherFilter },
      include: { signals: true },
    }),
  ]);

  // Group current week by day of week (0=Sun … 6=Sat)
  const dayBuckets = new Map<number, any[]>();
  for (let i = 0; i < 7; i++) dayBuckets.set(i, []);

  for (const obs of currentWeekObs as any[]) {
    const dayOfWeek = new Date(obs.observedAt).getDay();
    dayBuckets.get(dayOfWeek)!.push(obs);
  }

  // MON–SUN order
  const dayOrder = [1, 2, 3, 4, 5, 6, 0];
  const dayNames = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

  const days: DailyDriftPoint[] = dayOrder.map((dayIdx, i) => {
    const dayObs = dayBuckets.get(dayIdx)!;
    let driftCount = 0;
    let totalSignals = 0;
    for (const obs of dayObs) {
      for (const sig of obs.signals as any[]) {
        if (sig.notObserved || !sig.valueKey) continue;
        totalSignals++;
        const score = SCALE_SCORES[sig.valueKey];
        if (score !== undefined && score <= 2) driftCount++; // LIMITED or SOME
      }
    }
    return {
      dayLabel: dayNames[i],
      observationCount: dayObs.length,
      driftCount,
      driftScore: totalSignals > 0 ? driftCount / totalSignals : 0,
    };
  });

  // Week-over-week drift change
  let currentDriftTotal = 0;
  let currentSignalTotal = 0;
  for (const obs of currentWeekObs as any[]) {
    for (const sig of obs.signals as any[]) {
      if (sig.notObserved || !sig.valueKey) continue;
      currentSignalTotal++;
      const score = SCALE_SCORES[sig.valueKey];
      if (score !== undefined && score <= 2) currentDriftTotal++;
    }
  }

  let prevDriftTotal = 0;
  let prevSignalTotal = 0;
  for (const obs of prevWeekObs as any[]) {
    for (const sig of obs.signals as any[]) {
      if (sig.notObserved || !sig.valueKey) continue;
      prevSignalTotal++;
      const score = SCALE_SCORES[sig.valueKey];
      if (score !== undefined && score <= 2) prevDriftTotal++;
    }
  }

  const currentDriftRate = currentSignalTotal > 0 ? currentDriftTotal / currentSignalTotal : 0;
  const prevDriftRate = prevSignalTotal > 0 ? prevDriftTotal / prevSignalTotal : 0;
  const weekOverWeekChange =
    prevDriftRate > 0
      ? ((currentDriftRate - prevDriftRate) / prevDriftRate) * 100
      : 0;

  return { days, weekOverWeekChange };
}
