import { academicYearStart, addDays } from "./attendanceSync";

// Version 3 backfills independent totals from the accessible lesson marks.
// Roll-call access is unavailable; never mix these with statutory totals.
export const ATTENDANCE_SYNC_VERSION = 3;
export function attendanceBatchStart(config: Record<string, unknown>, end: Date): Date {
  const yearStart = academicYearStart(end);
  const checkpoint = typeof config.attendanceLastSyncedDate === "string"
    ? new Date(`${config.attendanceLastSyncedDate}T00:00:00Z`) : null;
  return config.attendanceSyncVersion === ATTENDANCE_SYNC_VERSION && checkpoint
    && !Number.isNaN(checkpoint.getTime()) && checkpoint >= yearStart && checkpoint <= end
    ? addDays(checkpoint, 1) : yearStart;
}
