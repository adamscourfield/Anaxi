export type HistoricTimetableStaffRecord = {
  effectiveDate: string | null;
  endDate: string | null;
  staff: { id: string; fullName: string } | null;
};

/** A historical teacher must have a dated allocation overlapping the teaching year. */
export function historicTimetableStaff(records: HistoricTimetableStaffRecord[], from: string, through: string) {
  return [...new Map(records.flatMap((record) => {
    if (!record.staff || !record.effectiveDate || record.effectiveDate.slice(0, 10) > through ||
      (record.endDate && record.endDate.slice(0, 10) < from)) return [];
    return [[record.staff.id, record.staff] as const];
  })).values()];
}
