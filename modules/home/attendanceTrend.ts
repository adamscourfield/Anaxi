import { prisma } from "@/lib/prisma";

type Snapshot = { snapshotDate: Date; attendancePossibleCount: number; attendancePresentCount: number };
export type AttendanceTrend = { weekPct: number | null; previousWeekPct: number | null; monthPct: number | null };
export const EMPTY_ATTENDANCE_TREND: AttendanceTrend = { weekPct: null, previousWeekPct: null, monthPct: null };

/** Exact calendar-date pairs only: never stretch a missing baseline into a rolling period. */
export function attendanceRateBetween(students: { snapshots: Snapshot[] }[], start: Date, end: Date): number | null {
  let possible = 0, present = 0;
  const key = (date: Date) => date.toISOString().slice(0, 10);
  for (const student of students) {
    const first = student.snapshots.find(row => key(row.snapshotDate) === key(start));
    const last = student.snapshots.find(row => key(row.snapshotDate) === key(end));
    if (!first || !last) continue;
    const deltaPossible = last.attendancePossibleCount - first.attendancePossibleCount;
    const deltaPresent = last.attendancePresentCount - first.attendancePresentCount;
    if (deltaPossible <= 0 || deltaPresent < 0 || deltaPresent > deltaPossible) continue;
    possible += deltaPossible;
    present += deltaPresent;
  }
  return possible ? present / possible * 100 : null;
}

export async function fetchAttendanceTrend(tenantId: string, today: Date): Promise<AttendanceTrend> {
  const daysBefore = (days: number) => new Date(today.getTime() - days * 86400000);
  const end = daysBefore(1);
  const students = await prisma.student.findMany({
    where: { tenantId, status: "ACTIVE" },
    select: { snapshots: {
      where: { countScope: "YEAR_TO_DATE", attendancePossibleCount: { gt: 0 }, snapshotDate: { gte: daysBefore(29), lt: today } },
      orderBy: { snapshotDate: "desc" },
      select: { snapshotDate: true, attendancePossibleCount: true, attendancePresentCount: true },
    } },
  });
  return {
    weekPct: attendanceRateBetween(students, daysBefore(8), end),
    previousWeekPct: attendanceRateBetween(students, daysBefore(15), daysBefore(8)),
    monthPct: attendanceRateBetween(students, daysBefore(29), end),
  };
}
