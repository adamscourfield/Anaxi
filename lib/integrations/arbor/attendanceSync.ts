export type AttendanceTotals = {
  possible: number;
  present: number;
  late: number;
};

export function academicYearStart(date: Date): Date {
  const year = date.getUTCMonth() >= 8 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
  return utcDay(year, 8, 1);
}

export function utcDay(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function attendancePercentage(totals: AttendanceTotals): number {
  return totals.possible ? Math.round((totals.present / totals.possible) * 1000) / 10 : 0;
}
