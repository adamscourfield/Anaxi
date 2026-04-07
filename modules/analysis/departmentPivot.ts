/**
 * Department × Signal Pivot — Explorer
 *
 * Aggregates instructional signal means per department for the Explorer
 * departments pivot view.
 */

import { prisma } from "@/lib/prisma";
import { getSignalDefinitionsForSchoolType } from "@/modules/observations/getSignalsBySchoolType";

const SCALE_SCORES: Record<string, number> = {
  LIMITED: 1,
  SOME: 2,
  CONSISTENT: 3,
  STRONG: 4,
};

function windowBounds(windowDays: number): { currentStart: Date; currentEnd: Date; prevStart: Date } {
  const now = new Date();
  const currentEnd = now;
  const currentStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
  const prevStart = new Date(currentStart.getTime() - windowDays * 24 * 60 * 60 * 1000);
  return { currentStart, currentEnd, prevStart };
}

function computeMean(scores: number[]): number | null {
  if (scores.length === 0) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

function buildSignalMeans(
  signals: { signalKey: string; valueKey: string | null; notObserved: boolean }[]
): Map<string, { scores: number[]; count: number }> {
  const map = new Map<string, { scores: number[]; count: number }>();
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

export type DepartmentPivotSignalCell = {
  currentMean: number | null;
  prevMean: number | null;
  delta: number | null;
  coverageCount: number;
};

export type DepartmentPivotRow = {
  departmentId: string;
  departmentName: string;
  faculty: string | null;
  teacherCount: number;
  observationCount: number;
  signalData: Record<string, DepartmentPivotSignalCell>;
};

/**
 * Compute department × signal pivot for Explorer.
 * Optionally restrict to specific department IDs.
 */
export async function computeDepartmentPivot(
  tenantId: string,
  windowDays: number,
  filterDepartmentIds?: string[]
): Promise<{ rows: DepartmentPivotRow[]; computedAt: Date }> {
  const { currentStart, currentEnd, prevStart } = windowBounds(windowDays);

  const settings = await (prisma as any).tenantSettings.findUnique({ where: { tenantId } });
  const schoolType = settings?.schoolType ?? "SECONDARY";
  const allSignalKeys = getSignalDefinitionsForSchoolType(schoolType).map((s) => s.key);

  const deptWhere: any = { tenantId };
  if (filterDepartmentIds?.length) deptWhere.id = { in: filterDepartmentIds };

  const departments = await (prisma as any).department.findMany({
    where: deptWhere,
    include: {
      memberships: true,
    },
    orderBy: { name: "asc" },
  });

  const [currentObs, prevObs] = await Promise.all([
    (prisma as any).observation.findMany({
      where: { tenantId, observedAt: { gte: currentStart, lte: currentEnd } },
      include: { signals: true },
    }),
    (prisma as any).observation.findMany({
      where: { tenantId, observedAt: { gte: prevStart, lt: currentStart } },
      include: { signals: true },
    }),
  ]);

  const rows: DepartmentPivotRow[] = [];

  for (const dept of departments as any[]) {
    const teacherIds = new Set<string>((dept.memberships as any[]).map((m: any) => m.userId));
    const deptCurrentObs = (currentObs as any[]).filter((o: any) => teacherIds.has(o.observedTeacherId));
    const deptPrevObs = (prevObs as any[]).filter((o: any) => teacherIds.has(o.observedTeacherId));

    const currentSignals = deptCurrentObs.flatMap((o: any) => o.signals);
    const prevSignals = deptPrevObs.flatMap((o: any) => o.signals);

    const currentMeansMap = buildSignalMeans(currentSignals);
    const prevMeansMap = buildSignalMeans(prevSignals);

    const signalData: Record<string, DepartmentPivotSignalCell> = {};
    for (const signalKey of allSignalKeys) {
      const curr = currentMeansMap.get(signalKey);
      const prev = prevMeansMap.get(signalKey);
      const currentMean = curr ? computeMean(curr.scores) : null;
      const prevMean = prev ? computeMean(prev.scores) : null;
      const delta = currentMean !== null && prevMean !== null ? currentMean - prevMean : null;
      signalData[signalKey] = { currentMean, prevMean, delta, coverageCount: curr?.count ?? 0 };
    }

    rows.push({
      departmentId: dept.id,
      departmentName: dept.name,
      faculty: dept.faculty ?? null,
      teacherCount: teacherIds.size,
      observationCount: deptCurrentObs.length,
      signalData,
    });
  }

  return { rows, computedAt: new Date() };
}
