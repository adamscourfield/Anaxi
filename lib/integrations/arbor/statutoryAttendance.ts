export type StatutoryAttendanceRecord = {
  id: string;
  recordDate: string | null;
  student: { id: string };
  attendanceRollCall: { id: string; code: string | null } | null;
  attendanceMark: {
    code: string;
    isStatisticalPresent: boolean;
    isStatisticalApprovedEducationalActivity: boolean;
    isStatisticalPossibleAttendance: boolean;
    isDefaultLate: boolean;
  } | null;
  minutesLate: number | null;
};

/** Uses Arbor's final statutory roll-call records, never individual lesson marks. */
export function summariseStatutoryAttendance(records: StatutoryAttendanceRecord[], linkedIds: Set<string>, morningOnly = false) {
  const byStudent = new Map<string, { possible: number; present: number; late: number }>();
  const sessions = new Map<string, string>();
  for (const record of records) {
    if (!linkedIds.has(record.student.id)) continue;
    const slot = record.attendanceRollCall?.code?.toUpperCase();
    if (slot !== "AM" && slot !== "PM") throw new Error("Arbor statutory roll-call code is unrecognised; attendance was not imported.");
    if (!record.recordDate) throw new Error("Arbor statutory attendance record has no date.");
    if (morningOnly && slot !== "AM") continue;
    const key = `${record.student.id}:${record.recordDate.slice(0, 10)}:${slot}`;
    const existing = sessions.get(key);
    if (existing === record.id) continue;
    if (existing) throw new Error("Arbor returned duplicate statutory marks for a pupil's AM/PM session.");
    sessions.set(key, record.id);
    const mark = record.attendanceMark;
    // A blank final mark must not silently turn into an excluded session.
    if (!mark) throw new Error("Arbor statutory roll-call marks are incomplete for this date.");
    const totals = byStudent.get(record.student.id) ?? { possible: 0, present: 0, late: 0 };
    if (mark.isStatisticalPossibleAttendance) {
      totals.possible++;
      if (mark.isStatisticalPresent || mark.isStatisticalApprovedEducationalActivity) totals.present++;
    }
    if ((record.minutesLate ?? 0) > 0 || mark.isDefaultLate) totals.late++;
    byStudent.set(record.student.id, totals);
  }
  return { byStudent };
}
