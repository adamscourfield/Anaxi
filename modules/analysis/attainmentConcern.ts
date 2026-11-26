/**
 * "Down in 3 or more subjects": the headline for students whose results have genuinely slipped.
 *
 * A drop counts when a subject is 10 or more index points lower than at the previous result point:
 * a grade or more at GCSE (one grade is 11.1 points), and more than wobble on a percentage scale.
 * One dropped grade is routine for a student taking nine subjects, so a student is only flagged
 * when the drops are spread across at least three subjects (or every subject with a comparison,
 * for students with fewer than three, such as A-level students).
 */
export const SIGNIFICANT_CHANGE = 0.1;
export const SUBJECTS_FOR_CONCERN = 3;

type SubjectMovement = { movement: number | null };

export function subjectsDown<T extends SubjectMovement>(subjects: T[]): T[] {
  return subjects.filter((s) => s.movement !== null && s.movement <= -SIGNIFICANT_CHANGE + 1e-9);
}

export function subjectsUp<T extends SubjectMovement>(subjects: T[]): T[] {
  return subjects.filter((s) => s.movement !== null && s.movement >= SIGNIFICANT_CHANGE - 1e-9);
}

export function isDownInSeveralSubjects(student: { subjects: SubjectMovement[] }): boolean {
  const compared = student.subjects.filter((s) => s.movement !== null).length;
  if (!compared) return false;
  return subjectsDown(student.subjects).length >= Math.min(SUBJECTS_FOR_CONCERN, compared);
}

/** Most subjects down first, then the largest single drop. */
export function compareByConcern(a: { subjects: SubjectMovement[] }, b: { subjects: SubjectMovement[] }): number {
  const diff = subjectsDown(b.subjects).length - subjectsDown(a.subjects).length;
  if (diff) return diff;
  const worst = (s: { subjects: SubjectMovement[] }) => Math.min(0, ...s.subjects.map((x) => x.movement ?? 0));
  return worst(a) - worst(b);
}
