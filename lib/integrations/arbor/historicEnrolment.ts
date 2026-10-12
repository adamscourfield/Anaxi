export function historicAcademicYearStart(asOf: string): string {
  const date = new Date(asOf);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid historic timetable date");
  return `${date.getUTCFullYear() - (date.getUTCMonth() < 8 ? 1 : 0)}-09-01`;
}

/** Final exam cohorts can leave their classes before the June fallback date. */
export function historicEnrolmentIncluded(enrolment: {
  startDate: string | null;
  endDate: string | null;
  academicUnit: { displayName: string | null } | null;
}, asOf: string): boolean {
  if (enrolment.startDate && enrolment.startDate.slice(0, 10) > asOf) return false;
  const examCohort = /\bYear\s+(11|13)\b/i.test(enrolment.academicUnit?.displayName ?? "");
  const earliestEnd = examCohort ? historicAcademicYearStart(asOf) : asOf;
  return !enrolment.endDate || enrolment.endDate.slice(0, 10) >= earliestEnd;
}
