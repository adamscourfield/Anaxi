import { academicYearStart, addDays } from "./attendanceSync";

// Version 2 backfills independent statutory AM/PM session totals, including dates with
// manual student snapshots. Only a completed attendance batch advances us.
export const ATTENDANCE_SYNC_VERSION = 2;
export function attendanceBatchStart(config: Record<string, unknown>, end: Date): Date {
  const yearStart = academicYearStart(end);
  const checkpoint = typeof config.attendanceLastSyncedDate === "string"
    ? new Date(`${config.attendanceLastSyncedDate}T00:00:00Z`) : null;
  return config.attendanceSyncVersion === ATTENDANCE_SYNC_VERSION && checkpoint
    && !Number.isNaN(checkpoint.getTime()) && checkpoint >= yearStart && checkpoint <= end
    ? addDays(checkpoint, 1) : yearStart;
}
