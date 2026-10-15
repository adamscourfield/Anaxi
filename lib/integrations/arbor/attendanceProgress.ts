import { academicYearStart, addDays } from "./attendanceSync";

// Replay once to repair dates previously skipped because behaviour had already
// created a snapshot. Thereafter, only a completed attendance batch advances us.
export const ATTENDANCE_SYNC_VERSION = 1;
export function attendanceBatchStart(config: Record<string, unknown>, end: Date): Date {
  const yearStart = academicYearStart(end);
  const checkpoint = typeof config.attendanceLastSyncedDate === "string"
    ? new Date(`${config.attendanceLastSyncedDate}T00:00:00Z`) : null;
  return config.attendanceSyncVersion === ATTENDANCE_SYNC_VERSION && checkpoint
    && !Number.isNaN(checkpoint.getTime()) && checkpoint >= yearStart && checkpoint <= end
    ? addDays(checkpoint, 1) : yearStart;
}
