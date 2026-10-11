export type TeachingAssignment = { teacherId: string; className: string };

/** Shared teachers of one verified class are valid; competing classes are ambiguous. */
export function teachersForOneClass(assignments: TeachingAssignment[]): TeachingAssignment[] {
  const unique = [...new Map(assignments.map((assignment) => [
    `${assignment.teacherId}:${assignment.className}`, assignment,
  ])).values()];
  return new Set(unique.map((assignment) => assignment.className)).size === 1 ? unique : [];
}

/** Canonical labels preserve Further Maths as a separate subject. */
export function teachingSubjectKey(value: string): string {
  return value
    .toLocaleLowerCase("en-GB")
    .replace(/&/g, " and ")
    .replace(/^\s*(?:p8\s*:\s*)?%?\s*(?:y|year)\s*\d+\s*/i, "")
    .replace(/^\s*a\s*level\s+/i, "")
    .replace(/\s+gcse(?:\s*\(level\s*1\s*\/\s*2\))?/gi, "")
    .replace(/\s*\(level\s*1\s*\/\s*2\)/gi, "")
    .replace(/\b(?:mathematics|maths|math)\b/g, "maths")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

/** Old Arbor points may have an import timestamp and a locally renamed label. */
export function historicPointDate(point: {
  assessedAt: Date;
  dateTaken: Date | null;
  label: string;
  dataSource: string;
  cycle: { academicYear: string };
}): Date {
  if (point.dataSource !== "ARBOR") return point.dateTaken ?? point.assessedAt;
  const match = point.cycle.academicYear.match(/^(\d{4})\/(\d{4})$/);
  if (!match) return point.dateTaken ?? point.assessedAt;
  const startYear = Number(match[1]);
  const start = Date.UTC(startYear, 8, 1);
  const end = Date.UTC(Number(match[2]), 8, 1);
  for (const date of [point.dateTaken, point.assessedAt]) {
    if (date && date.getTime() >= start && date.getTime() < end) return date;
  }
  if (/autumn/i.test(point.label)) return new Date(Date.UTC(startYear, 11, 15));
  if (/spring/i.test(point.label)) return new Date(Date.UTC(startYear + 1, 2, 31));
  if (/^final$/i.test(point.label)) return new Date(Date.UTC(startYear + 1, 7, 31));
  // The imported End of Year point represents June assessments; use a
  // month-end attribution cutoff when Arbor has not supplied the actual date.
  return new Date(Date.UTC(startYear + 1, 5, 30));
}
