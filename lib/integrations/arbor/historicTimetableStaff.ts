export type HistoricTimetableStaffRecord = {
  effectiveDate: string | null;
  endDate: string | null;
  staff: { id: string; fullName: string } | null;
  slotEffectiveDate?: string | null;
  slotEndDate?: string | null;
};

/** A historical teacher must have a dated allocation overlapping the teaching year. */
export function historicTimetableStaff(records: HistoricTimetableStaffRecord[], from: string, through: string) {
  return [...new Map(records.flatMap((record) => {
    // An allocation without its own dates inherits a closed historical lesson
    // slot. Open-ended undated allocations are not historical evidence.
    const cycleEnd = `${Number(from.slice(0, 4)) + 1}-08-31`;
    const closedHistoricSlot = record.slotEffectiveDate && record.slotEndDate &&
      record.slotEffectiveDate.slice(0, 10) >= from && record.slotEndDate.slice(0, 10) <= cycleEnd;
    const start = record.effectiveDate ?? (closedHistoricSlot ? record.slotEffectiveDate : null);
    const end = record.endDate ?? record.slotEndDate;
    if (!record.staff || !start || start.slice(0, 10) > through ||
      (end && end.slice(0, 10) < from)) return [];
    if ((record.slotEffectiveDate && record.slotEffectiveDate.slice(0, 10) > through) ||
      (record.slotEndDate && record.slotEndDate.slice(0, 10) < from)) return [];
    return [[record.staff.id, record.staff] as const];
  })).values()];
}
