export type ArborAttendanceRecord = {
  student: { id: string };
  attendanceMark: { isStatisticalPresent: boolean; isStatisticalPossibleAttendance: boolean; isDefaultLate: boolean } | null;
  minutesLate: number | null;
  isRedundant: boolean;
  startDatetime?: string | null;
};

export function summariseAttendance(records: ArborAttendanceRecord[], linkedStudentIds: Set<string>) {
  const byStudent = new Map<string, { possible: number; present: number; late: number }>();
  let unmatched = 0;
  for (const record of records) {
    if (record.isRedundant || !record.attendanceMark) continue;
    if (!linkedStudentIds.has(record.student.id)) { unmatched++; continue; }
    const summary = byStudent.get(record.student.id) ?? { possible: 0, present: 0, late: 0 };
    if (record.attendanceMark.isStatisticalPossibleAttendance) { summary.possible++; if (record.attendanceMark.isStatisticalPresent) summary.present++; }
    if ((record.minutesLate ?? 0) > 0 || record.attendanceMark.isDefaultLate) summary.late++;
    byStudent.set(record.student.id, summary);
  }
  return { byStudent, unmatched };
}
