import type { CpdPriorityRow } from "@/modules/analysis/cpdPriorities";

export type LeaderSummaryInput = {
  attendancePct: number | null;
  studentFocusCount: number | null;
  studentFocusEnabled?: boolean;
  teacherFocusCount: number;
  teachersCovered: number;
  focus: CpdPriorityRow | undefined;
  strength: CpdPriorityRow | undefined;
};

export function buildStudentSummary(input: Pick<LeaderSummaryInput, "attendancePct" | "studentFocusCount" | "studentFocusEnabled">): string[] {
  const sentences: string[] = [];
  if (input.attendancePct !== null) sentences.push(`Attendance is ${input.attendancePct.toFixed(1)}% for the academic year to date.`);
  if (input.studentFocusCount !== null && input.studentFocusCount > 0) sentences.push(`${input.studentFocusCount} student${input.studentFocusCount === 1 ? " needs" : "s need"} a closer look under the existing risk indicators.`);
  if (input.studentFocusCount === 0) sentences.push("No students are flagged as urgent or priority in the available snapshots.");
  if (input.studentFocusEnabled && input.studentFocusCount === null) sentences.push("Student focus is unavailable: there are no recent student snapshots to assess attendance and behaviour priorities.");
  return sentences;
}

/** Deterministic copy; missing evidence never becomes an all-clear. */
export function buildLeaderSummary(input: LeaderSummaryInput): string[] {
  const sentences = buildStudentSummary(input);
  if (input.teacherFocusCount > 0) sentences.push(`Lesson signals suggest a follow-up with ${input.teacherFocusCount} teacher${input.teacherFocusCount === 1 ? "" : "s"}.`);
  else if (input.teachersCovered > 0) sentences.push("No teaching decline is flagged in the available evidence.");
  if (input.focus) sentences.push(`${input.focus.label} is the leading CPD focus, with declining signals for ${input.focus.teachersDriftingDown} of ${input.focus.teachersCovered} teachers covered.`);
  if (input.strength) sentences.push(`${input.strength.label} shows positive movement for ${input.strength.teachersImproving} of ${input.strength.teachersCovered} teachers covered.`);
  if (!sentences.length) sentences.push("There is not enough comparable evidence to build a school briefing yet. Recorded observations and attendance snapshots will appear here as they become available.");
  return sentences;
}
