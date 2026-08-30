/**
 * Behaviour Cohort Pivot — Explorer
 *
 * Aggregates student behaviour/attendance metrics by year group.
 */

import { prisma } from "@/lib/prisma";

function windowBounds(windowDays: number): {
  currentStart: Date;
  currentEnd: Date;
  prevStart: Date;
} {
  const now = new Date();
  const currentEnd = now;
  const currentStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
  const prevStart = new Date(currentStart.getTime() - windowDays * 24 * 60 * 60 * 1000);
  return { currentStart, currentEnd, prevStart };
}

function mean(arr: number[]): number | null {
  if (arr.length === 0) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export type CohortPivotRow = {
  yearGroup: string;
  studentsCovered: number;
  /** Number of students behind attendanceDelta (only those with both a current and previous snapshot). */
  pairedCount: number;
  attendanceMean: number | null;
  attendanceDelta: number | null;
  detentionsMean: number | null;
  detentionsDelta: number | null;
  onCallsMean: number | null;
  onCallsDelta: number | null;
  latenessMean: number | null;
  latenessDelta: number | null;
  suspensionsCount: number;
  suspensionsDelta: number | null;
  internalExclusionsCount: number;
  internalExclusionsDelta: number | null;
};

export async function computeCohortPivot(
  tenantId: string,
  windowDays: number
): Promise<{ rows: CohortPivotRow[]; computedAt: Date }> {
  const { currentStart, currentEnd, prevStart } = windowBounds(windowDays);

  const students = await (prisma as any).student.findMany({
    where: { tenantId, status: "ACTIVE" },
    include: {
      snapshots: {
        where: { snapshotDate: { gte: prevStart, lte: currentEnd } },
        orderBy: { snapshotDate: "desc" },
      },
    },
  });

  // Group by yearGroup
  const cohortMap = new Map<string, {
    current: any[];
    prev: any[];
  }>();

  for (const student of students as any[]) {
    const yg = student.yearGroup ?? "Unknown";
    if (!cohortMap.has(yg)) cohortMap.set(yg, { current: [], prev: [] });

    const snapshots: any[] = student.snapshots ?? [];
    const currentSnap = snapshots.find(
      (s: any) => new Date(s.snapshotDate) >= currentStart && new Date(s.snapshotDate) <= currentEnd
    );
    const prevSnap = snapshots.find(
      (s: any) => new Date(s.snapshotDate) >= prevStart && new Date(s.snapshotDate) < currentStart
    );

    if (currentSnap) cohortMap.get(yg)!.current.push({ student, snap: currentSnap });
    if (prevSnap) cohortMap.get(yg)!.prev.push({ student, snap: prevSnap });
  }

  const rows: CohortPivotRow[] = [];

  for (const [yearGroup, { current, prev }] of cohortMap.entries()) {
    if (current.length === 0) continue;

    const prevByStudentId = new Map(prev.map((p: any) => [p.student.id, p.snap]));

    const attendanceCurrent = current.map((e: any) => Number(e.snap.attendancePct));
    const detentionsCurrent = current.map((e: any) => e.snap.detentionsCount as number);
    const onCallsCurrent = current.map((e: any) => e.snap.onCallsCount as number);
    const latenessCurrent = current.map((e: any) => e.snap.latenessCount as number);
    const suspensionsCurrent = current.reduce((sum: number, e: any) => sum + (e.snap.suspensionsCount as number), 0);
    const internalExclusionsCurrent = current.reduce((sum: number, e: any) => sum + (e.snap.internalExclusionsCount as number), 0);

    // For deltas: only students that have both current and prev snapshots
    const paired = current.filter((e: any) => prevByStudentId.has(e.student.id));
    const attendanceDeltas = paired.map((e: any) => Number(e.snap.attendancePct) - Number(prevByStudentId.get(e.student.id)!.attendancePct));
    const detentionsDeltas = paired.map((e: any) => (e.snap.detentionsCount as number) - (prevByStudentId.get(e.student.id)!.detentionsCount as number));
    const onCallsDeltas = paired.map((e: any) => (e.snap.onCallsCount as number) - (prevByStudentId.get(e.student.id)!.onCallsCount as number));
    const latenessDeltas = paired.map((e: any) => (e.snap.latenessCount as number) - (prevByStudentId.get(e.student.id)!.latenessCount as number));
    const suspensionsDelta = paired.length > 0 ? paired.reduce((sum: number, e: any) => sum + ((e.snap.suspensionsCount as number) - (prevByStudentId.get(e.student.id)!.suspensionsCount as number)), 0) : null;
    const internalExclusionsDelta = paired.length > 0 ? paired.reduce((sum: number, e: any) => sum + ((e.snap.internalExclusionsCount as number) - (prevByStudentId.get(e.student.id)!.internalExclusionsCount as number)), 0) : null;

    rows.push({
      yearGroup,
      studentsCovered: current.length,
      pairedCount: paired.length,
      attendanceMean: mean(attendanceCurrent),
      attendanceDelta: mean(attendanceDeltas),
      detentionsMean: mean(detentionsCurrent),
      detentionsDelta: mean(detentionsDeltas),
      onCallsMean: mean(onCallsCurrent),
      onCallsDelta: mean(onCallsDeltas),
      latenessMean: mean(latenessCurrent),
      latenessDelta: mean(latenessDeltas),
      suspensionsCount: suspensionsCurrent,
      suspensionsDelta,
      internalExclusionsCount: internalExclusionsCurrent,
      internalExclusionsDelta,
    });
  }

  // Sort by year group
  rows.sort((a, b) => a.yearGroup.localeCompare(b.yearGroup));

  return { rows, computedAt: new Date() };
}
