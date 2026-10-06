import type { ArborStudentRecord } from "./types";

export type HistoricStudentDestination = "PRIMARY" | "SECONDARY";

/**
 * Estimates the pupil's final school year from their Arbor leaving date and
 * date of birth. It deliberately returns null where Arbor has not supplied
 * enough evidence, so a leaver is never placed in the wrong Anaxi school.
 */
export function historicYearGroup(student: ArborStudentRecord): string | null {
  if (!student.leavingDate || !student.dateOfBirth) return null;
  const leaving = new Date(student.leavingDate);
  const birth = new Date(student.dateOfBirth);
  if (Number.isNaN(leaving.getTime()) || Number.isNaN(birth.getTime())) return null;

  // A school year starts on 1 September. Measure age on the preceding 31
  // August, which matches the English year-group cut-off.
  const academicStartYear = leaving.getUTCMonth() >= 8 ? leaving.getUTCFullYear() : leaving.getUTCFullYear() - 1;
  const cutOff = new Date(Date.UTC(academicStartYear, 7, 31));
  let age = cutOff.getUTCFullYear() - birth.getUTCFullYear();
  if (birth.getUTCMonth() > 7 || (birth.getUTCMonth() === 7 && birth.getUTCDate() > 31)) age--;
  const year = age - 4;
  return year >= 1 && year <= 13 ? `Y${year}` : null;
}

export function historicStudentDestination(yearGroup: string | null): HistoricStudentDestination | null {
  const year = Number(yearGroup?.replace(/^Y/, ""));
  if (year >= 1 && year <= 6) return "PRIMARY";
  if (year >= 7 && year <= 13) return "SECONDARY";
  return null;
}
