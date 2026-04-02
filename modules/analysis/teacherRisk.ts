/**
 * Teacher Risk Index (TRI) — Phase 1A
 *
 * Computes per-teacher instructional drift scores from observation signal data.
 * This is a movement + coverage-weighted drift indicator, NOT a grading tool.
 */

import { prisma } from "@/lib/prisma";
import { SIGNAL_DEFINITIONS } from "@/modules/observations/signalDefinitions";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Numeric score mapping for scale keys */
const SCALE_SCORES: Record<string, number> = {
  LIMITED: 1,
  SOME: 2,
  CONSISTENT: 3,
  STRONG: 4,
};

/** Default thresholds (used when TenantSettings record is absent) */
const DEFAULT_MIN_COVERAGE = 6;
const DEFAULT_DRIFT_THRESHOLD = 0.35;

/** Risk band thresholds (v1) */
const SIGNIFICANT_DRIFT_THRESHOLD = 2.0;
const EMERGING_DRIFT_THRESHOLD = 1.0;

const ALL_SIGNAL_KEYS = SIGNAL_DEFINITIONS.map((s) => s.key);

// ─── Types ────────────────────────────────────────────────────────────────────

export type RiskStatus =
  | "STABLE"
  | "EMERGING_DRIFT"
  | "SIGNIFICANT_DRIFT"
  | "LOW_COVERAGE";

export type TopDriver = {
  signalKey: string;
  delta: number;
  currentMean: number;
  prevMean: number;
};

export type TeacherRiskRow = {
  teacherMembershipId: string;
  teacherName: string;
  teacherRole: string;
  departmentNames: string[];
  teacherCoverage: number;
  lastObservationAt: Date | null;
  normalizedIDS: number;
  status: RiskStatus;
  topDrivers: TopDriver[];
};

export type SignalProfileEntry = {
  signalKey: string;
  label: string;
  currentMean: number | null;
  prevMean: number | null;
  delta: number | null;
  coverageCount: number;
  driftContribution: number;
};

export type TeacherSignalProfile = {
  teacherMembershipId: string;
  teacherName: string;
  teacherCoverage: number;
  lastObservationAt: Date | null;
  signals: SignalProfileEntry[];
  normalizedIDS: number;
  status: RiskStatus;
  computedAt: Date;
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

function windowBounds(windowDays: number): { currentStart: Date; currentEnd: Date; prevStart: Date; prevEnd: Date } {
  const now = new Date();
  const currentEnd = now;
  const currentStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
  const prevEnd = currentStart;
  const prevStart = new Date(currentStart.getTime() - windowDays * 24 * 60 * 60 * 1000);
  return { currentStart, currentEnd, prevStart, prevEnd };
}

/** Compute mean of scores, excluding notObserved entries */
function computeMean(scores: number[]): number | null {
  if (scores.length === 0) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

type SignalMeans = Map<string, { scores: number[]; count: number }>;

function buildSignalMeans(signals: { signalKey: string; valueKey: string | null; notObserved: boolean }[]): SignalMeans {
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

function computeIDS(
  currentMeans: SignalMeans,
  prevMeans: SignalMeans,
  driftThreshold: number
): { ids: number; normalizedIDS: number; eligibleSignals: number } {
  let ids = 0;
  let eligibleSignals = 0;

  for (const signalKey of ALL_SIGNAL_KEYS) {
    const curr = currentMeans.get(signalKey);
    const prev = prevMeans.get(signalKey);
    const currentMean = curr ? computeMean(curr.scores) : null;
    const prevMean = prev ? computeMean(prev.scores) : null;

    if (currentMean === null || prevMean === null) continue;

    eligibleSignals++;
    const delta = currentMean - prevMean;
    if (delta < -driftThreshold) {
      ids += Math.abs(delta);
    }
  }

  const normalizedIDS = eligibleSignals > 0 ? ids * (ALL_SIGNAL_KEYS.length / eligibleSignals) : 0;
  return { ids, normalizedIDS, eligibleSignals };
}

function classifyStatus(normalizedIDS: number, teacherCoverage: number, minCoverage: number): RiskStatus {
  if (teacherCoverage < minCoverage) return "LOW_COVERAGE";
  if (normalizedIDS >= SIGNIFICANT_DRIFT_THRESHOLD) return "SIGNIFICANT_DRIFT";
  if (normalizedIDS >= EMERGING_DRIFT_THRESHOLD) return "EMERGING_DRIFT";
  return "STABLE";
}

const STATUS_ORDER: Record<RiskStatus, number> = {
  SIGNIFICANT_DRIFT: 0,
  EMERGING_DRIFT: 1,
  STABLE: 2,
  LOW_COVERAGE: 3,
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Compute the Teacher Risk Index for all teachers in a tenant.
 */
export async function computeTeacherRiskIndex(
  tenantId: string,
  windowDays: number
): Promise<TeacherRiskRow[]> {
  const settings = await (prisma as any).tenantSettings.findUnique({ where: { tenantId } });
  const minCoverage: number = settings?.minObservationCount ?? DEFAULT_MIN_COVERAGE;
  const driftThreshold: number = settings?.driftDeltaThreshold ?? DEFAULT_DRIFT_THRESHOLD;

  const { currentStart, currentEnd, prevStart, prevEnd } = windowBounds(windowDays);

  // Load current and previous window observations for the tenant
  const [currentObs, prevObs] = await Promise.all([
    (prisma as any).observation.findMany({
      where: { tenantId, observedAt: { gte: currentStart, lte: currentEnd } },
      include: { signals: true, observedTeacher: true },
    }),
    (prisma as any).observation.findMany({
      where: { tenantId, observedAt: { gte: prevStart, lt: currentStart } },
      include: { signals: true },
    }),
  ]);

  // Load department memberships for all teachers
  const deptMemberships = await (prisma as any).departmentMembership.findMany({
    where: { tenantId },
    include: { department: true },
  });
  const teacherDepts = new Map<string, string[]>();
  for (const m of deptMemberships) {
    if (!teacherDepts.has(m.userId)) teacherDepts.set(m.userId, []);
    teacherDepts.get(m.userId)!.push(m.department.name);
  }

  // Group current and previous observations by teacher
  const currentByTeacher = new Map<string, typeof currentObs>();
  for (const obs of currentObs) {
    if (!currentByTeacher.has(obs.observedTeacherId)) currentByTeacher.set(obs.observedTeacherId, []);
    currentByTeacher.get(obs.observedTeacherId)!.push(obs);
  }

  const prevByTeacher = new Map<string, typeof prevObs>();
  for (const obs of prevObs) {
    if (!prevByTeacher.has(obs.observedTeacherId)) prevByTeacher.set(obs.observedTeacherId, []);
    prevByTeacher.get(obs.observedTeacherId)!.push(obs);
  }

  const teacherIds = Array.from(
    new Set([
      ...currentByTeacher.keys(),
      ...prevByTeacher.keys(),
    ]),
  );

  const teachers = await (prisma as any).user.findMany({
    where: { tenantId, id: { in: teacherIds } },
    select: { id: true, fullName: true, role: true },
  });
  const teacherById = new Map<string, { id: string; fullName: string; role: string | null }>(
    teachers.map((teacher: { id: string; fullName: string; role: string | null }) => [teacher.id, teacher]),
  );

  const rows: TeacherRiskRow[] = [];

  for (const teacherId of teacherIds) {
    const teacher = teacherById.get(teacherId);
    if (!teacher) continue;
    const teacherCurrentObs = currentByTeacher.get(teacherId) ?? [];

    const teacherCoverage = teacherCurrentObs.length;
    const lastObservationAt = teacherCurrentObs.reduce((latest: Date | null, obs: any) => {
      const d = new Date(obs.observedAt);
      return latest === null || d > latest ? d : latest;
    }, null);

    // Build signal means for current and prev windows
    const currentSignals = teacherCurrentObs.flatMap((o: any) => o.signals);
    const prevTeacherObs = prevByTeacher.get(teacherId) ?? [];
    const prevSignals = prevTeacherObs.flatMap((o: any) => o.signals);

    const currentMeans = buildSignalMeans(currentSignals);
    const prevMeans = buildSignalMeans(prevSignals);

    const { normalizedIDS } = computeIDS(currentMeans, prevMeans, driftThreshold);
    const status = classifyStatus(normalizedIDS, teacherCoverage, minCoverage);

    // Compute top drivers (signals with driftContribution > 0)
    const topDrivers: TopDriver[] = [];
    for (const signalKey of ALL_SIGNAL_KEYS) {
      const curr = currentMeans.get(signalKey);
      const prev = prevMeans.get(signalKey);
      const currentMeanVal = curr ? computeMean(curr.scores) : null;
      const prevMeanVal = prev ? computeMean(prev.scores) : null;
      if (currentMeanVal === null || prevMeanVal === null) continue;
      const delta = currentMeanVal - prevMeanVal;
      if (delta < -driftThreshold) {
        topDrivers.push({ signalKey, delta, currentMean: currentMeanVal, prevMean: prevMeanVal });
      }
    }
    topDrivers.sort((a, b) => a.delta - b.delta);

    rows.push({
      teacherMembershipId: teacherId,
      teacherName: teacher.fullName,
      teacherRole: teacher.role ?? "",
      departmentNames: teacherDepts.get(teacherId) ?? [],
      teacherCoverage,
      lastObservationAt,
      normalizedIDS,
      status,
      topDrivers: topDrivers.slice(0, 3),
    });
  }

  // Sort: primary by status order, secondary by normalizedIDS desc
  rows.sort((a, b) => {
    const statusDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (statusDiff !== 0) return statusDiff;
    return b.normalizedIDS - a.normalizedIDS;
  });

  return rows;
}

/**
 * Compute the detailed signal profile for a single teacher.
 */
export async function computeTeacherSignalProfile(
  tenantId: string,
  teacherMembershipId: string,
  windowDays: number
): Promise<TeacherSignalProfile | null> {
  const settings = await (prisma as any).tenantSettings.findUnique({ where: { tenantId } });
  const minCoverage: number = settings?.minObservationCount ?? DEFAULT_MIN_COVERAGE;
  const driftThreshold: number = settings?.driftDeltaThreshold ?? DEFAULT_DRIFT_THRESHOLD;

  const { currentStart, currentEnd, prevStart } = windowBounds(windowDays);

  const [teacher, currentObs, prevObs, signalLabels] = await Promise.all([
    (prisma as any).user.findFirst({ where: { id: teacherMembershipId, tenantId, isActive: true } }),
    (prisma as any).observation.findMany({
      where: { tenantId, observedTeacherId: teacherMembershipId, observedAt: { gte: currentStart, lte: currentEnd } },
      include: { signals: true },
    }),
    (prisma as any).observation.findMany({
      where: { tenantId, observedTeacherId: teacherMembershipId, observedAt: { gte: prevStart, lt: currentStart } },
      include: { signals: true },
    }),
    (prisma as any).tenantSignalLabel.findMany({ where: { tenantId } }),
  ]);

  if (!teacher) return null;

  const labelMap = new Map<string, string>(
    (signalLabels as any[]).map((l: any) => [l.signalKey, l.displayName])
  );

  const teacherCoverage = currentObs.length;
  const lastObservationAt = (currentObs as any[]).reduce((latest: Date | null, obs: any) => {
    const d = new Date(obs.observedAt);
    return latest === null || d > latest ? d : latest;
  }, null);

  const currentSignals = (currentObs as any[]).flatMap((o: any) => o.signals);
  const prevSignals = (prevObs as any[]).flatMap((o: any) => o.signals);

  const currentMeans = buildSignalMeans(currentSignals);
  const prevMeans = buildSignalMeans(prevSignals);

  const signals: SignalProfileEntry[] = ALL_SIGNAL_KEYS.map((signalKey) => {
    const sigDef = SIGNAL_DEFINITIONS.find((s) => s.key === signalKey)!;
    const label = labelMap.get(signalKey) ?? sigDef.displayNameDefault;
    const curr = currentMeans.get(signalKey);
    const prev = prevMeans.get(signalKey);
    const currentMean = curr ? computeMean(curr.scores) : null;
    const prevMean = prev ? computeMean(prev.scores) : null;
    const coverageCount = curr?.count ?? 0;

    let delta: number | null = null;
    let driftContribution = 0;
    if (currentMean !== null && prevMean !== null) {
      delta = currentMean - prevMean;
      if (delta < -driftThreshold) {
        driftContribution = Math.abs(delta);
      }
    }

    return { signalKey, label, currentMean, prevMean, delta, coverageCount, driftContribution };
  });

  // Sort by worst delta first (nulls last)
  signals.sort((a, b) => {
    if (a.delta === null && b.delta === null) return 0;
    if (a.delta === null) return 1;
    if (b.delta === null) return -1;
    return a.delta - b.delta;
  });

  const { normalizedIDS } = computeIDS(currentMeans, prevMeans, driftThreshold);
  const status = classifyStatus(normalizedIDS, teacherCoverage, minCoverage);

  return {
    teacherMembershipId,
    teacherName: teacher.fullName,
    teacherCoverage,
    lastObservationAt,
    signals,
    normalizedIDS,
    status,
    computedAt: new Date(),
  };
}

// ─── Batch Teacher Pivot (for Explorer) ──────────────────────────────────────

export type TeacherPivotSignalCell = {
  currentMean: number | null;
  prevMean: number | null;
  delta: number | null;
  coverageCount: number;
};

export type TeacherPivotRow = {
  teacherMembershipId: string;
  teacherName: string;
  teacherRole: string;
  departmentNames: string[];
  teacherCoverage: number;
  lastObservationAt: Date | null;
  normalizedIDS: number;
  status: RiskStatus;
  signalData: Record<string, TeacherPivotSignalCell>;
};

/**
 * Compute full teacher × signal pivot for Explorer.
 * Optionally filter to a subset of teacher IDs.
 */
export async function computeTeacherPivot(
  tenantId: string,
  windowDays: number,
  filterTeacherIds?: string[]
): Promise<{ rows: TeacherPivotRow[]; computedAt: Date }> {
  const settings = await (prisma as any).tenantSettings.findUnique({ where: { tenantId } });
  const minCoverage: number = settings?.minObservationCount ?? DEFAULT_MIN_COVERAGE;
  const driftThreshold: number = settings?.driftDeltaThreshold ?? DEFAULT_DRIFT_THRESHOLD;

  const { currentStart, currentEnd, prevStart } = windowBounds(windowDays);

  const teacherFilter = filterTeacherIds ? { observedTeacherId: { in: filterTeacherIds } } : {};

  const [currentObs, prevObs, deptMemberships, signalLabels] = await Promise.all([
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
    (prisma as any).tenantSignalLabel.findMany({ where: { tenantId } }),
  ]);

  const labelMap = new Map<string, string>(
    (signalLabels as any[]).map((l: any) => [l.signalKey, l.displayName])
  );

  const teacherDepts = new Map<string, string[]>();
  for (const m of deptMemberships as any[]) {
    if (!teacherDepts.has(m.userId)) teacherDepts.set(m.userId, []);
    teacherDepts.get(m.userId)!.push(m.department.name);
  }

  const currentByTeacher = new Map<string, any[]>();
  for (const obs of currentObs as any[]) {
    if (!currentByTeacher.has(obs.observedTeacherId)) currentByTeacher.set(obs.observedTeacherId, []);
    currentByTeacher.get(obs.observedTeacherId)!.push(obs);
  }

  const prevByTeacher = new Map<string, any[]>();
  for (const obs of prevObs as any[]) {
    if (!prevByTeacher.has(obs.observedTeacherId)) prevByTeacher.set(obs.observedTeacherId, []);
    prevByTeacher.get(obs.observedTeacherId)!.push(obs);
  }

  const rows: TeacherPivotRow[] = [];

  for (const [teacherId, teacherCurrentObs] of currentByTeacher.entries()) {
    const teacher = teacherCurrentObs[0]?.observedTeacher;
    if (!teacher) continue;

    const teacherCoverage = teacherCurrentObs.length;
    const lastObservationAt = teacherCurrentObs.reduce((latest: Date | null, obs: any) => {
      const d = new Date(obs.observedAt);
      return latest === null || d > latest ? d : latest;
    }, null);

    const currentSignals = teacherCurrentObs.flatMap((o: any) => o.signals);
    const prevTeacherObs = prevByTeacher.get(teacherId) ?? [];
    const prevSignals = prevTeacherObs.flatMap((o: any) => o.signals);

    const currentMeans = buildSignalMeans(currentSignals);
    const prevMeans = buildSignalMeans(prevSignals);

    const { normalizedIDS } = computeIDS(currentMeans, prevMeans, driftThreshold);
    const status = classifyStatus(normalizedIDS, teacherCoverage, minCoverage);

    const signalData: Record<string, TeacherPivotSignalCell> = {};
    for (const signalKey of ALL_SIGNAL_KEYS) {
      const curr = currentMeans.get(signalKey);
      const prev = prevMeans.get(signalKey);
      const currentMean = curr ? computeMean(curr.scores) : null;
      const prevMean = prev ? computeMean(prev.scores) : null;
      const delta = currentMean !== null && prevMean !== null ? currentMean - prevMean : null;
      signalData[signalKey] = { currentMean, prevMean, delta, coverageCount: curr?.count ?? 0 };
    }

    rows.push({
      teacherMembershipId: teacherId,
      teacherName: teacher.fullName,
      teacherRole: teacher.role ?? "",
      departmentNames: teacherDepts.get(teacherId) ?? [],
      teacherCoverage,
      lastObservationAt,
      normalizedIDS,
      status,
      signalData,
    });
  }

  rows.sort((a, b) => {
    const statusDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (statusDiff !== 0) return statusDiff;
    return b.normalizedIDS - a.normalizedIDS;
  });

  return { rows, computedAt: new Date() };
}
