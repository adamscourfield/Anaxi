import type { AttendanceTrend } from "./attendanceTrend";
import { prisma } from "@/lib/prisma";
import { academicYearStart, addDays, dateKey } from "@/lib/integrations/arbor/attendanceSync";

type Day = { checkDate: Date; fullDayPossibleCount: number | null; fullDayPresentCount: number | null; fullDayStudentsCovered: number | null };

/** Sum sessions within the inclusive window. A missing import is never a zero-attendance day. */
export function attendanceTotalsBetween(rows: Day[], start: Date, end: Date) {
  const byDate = new Map(rows.map(row => [dateKey(row.checkDate), row]));
  let possible = 0, present = 0;
  for (let day = start; day <= end; day = addDays(day, 1)) {
    const row = byDate.get(dateKey(day));
    if (!row || row.fullDayPossibleCount === null || row.fullDayPresentCount === null
      || row.fullDayPossibleCount < 0 || row.fullDayPresentCount < 0
      || row.fullDayPresentCount > row.fullDayPossibleCount) return null;
    possible += row.fullDayPossibleCount;
    present += row.fullDayPresentCount;
  }
  return possible > 0 ? { possible, present, pct: present / possible * 100 } : null;
}

export function schoolAttendanceSummary(rows: Day[], today: Date) {
  const end = addDays(today, -1);
  const year = attendanceTotalsBetween(rows, academicYearStart(end), end);
  const rate = (days: number) => attendanceTotalsBetween(rows, addDays(today, -days), end)?.pct ?? null;
  const latest = rows.find(row => dateKey(row.checkDate) === dateKey(end));
  return {
    headline: year ? { attendancePct: year.pct, asOf: end, studentsCovered: latest?.fullDayStudentsCovered ?? 0 } : null,
    trend: { weekPct: rate(7), threeWeekPct: rate(21), monthPct: rate(28) } as AttendanceTrend,
  };
}

export async function fetchSchoolAttendance(tenantId: string, today: Date) {
  const rows = await prisma.dailyAttendanceCheck.findMany({
    where: { tenantId, checkDate: { gte: academicYearStart(addDays(today, -1)), lt: today } },
    select: { checkDate: true, fullDayPossibleCount: true, fullDayPresentCount: true, fullDayStudentsCovered: true },
  });
  return schoolAttendanceSummary(rows, today);
}
