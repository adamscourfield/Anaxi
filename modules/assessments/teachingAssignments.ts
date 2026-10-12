import { arborClassSubjectName } from "@/lib/integrations/arbor/academicUnitSubject";

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

export function uniqueHistoricPupilAliases(
  assessed: Array<{ id: string; fullName: string; externalId: string | null }>,
  roster: Array<{ id: string; fullName: string; externalId: string | null }>,
): Map<string, string> {
  const nameKey = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  const candidates = new Map<string, Set<string>>();
  for (const pupil of roster) {
    if (!pupil.externalId || !nameKey(pupil.fullName)) continue;
    const key = nameKey(pupil.fullName);
    if (!candidates.has(key)) candidates.set(key, new Set());
    candidates.get(key)!.add(pupil.id);
  }
  const aliases = new Map<string, string>();
  for (const pupil of assessed) {
    // An existing Arbor identity must never be replaced by a name match.
    if (pupil.externalId) continue;
    const matches = candidates.get(nameKey(pupil.fullName));
    if (matches?.size === 1) aliases.set(pupil.id, [...matches][0]);
  }
  return aliases;
}

export function teachingClassSubjectKey(className: string | null): string {
  return teachingSubjectKey(arborClassSubjectName(className));
}

export function teachersForAssessmentClass(assignments: TeachingAssignment[], yearGroup: string): TeachingAssignment[] {
  const year = yearGroup.match(/\d+/)?.[0];
  let matches = assignments;
  if (year) {
    const cohort = assignments.filter((assignment) => new RegExp(`\\bYear\\s+${year}\\b`, "i").test(assignment.className));
    if (cohort.length) matches = cohort;
  }
  const core = matches.filter((assignment) => !/\b(?:CCE|intervention)\b|\bCore\s+(?:PE|RE)\b/i.test(assignment.className));
  const selected = core.length ? core : matches;
  // Every retained historic link is an actual dated Arbor membership. Pupils
  // who moved core classes still have a known teaching team in each group;
  // retain those teachers and let the metrics count each pupil once per teacher.
  return [...new Map(selected.map((assignment) => [`${assignment.teacherId}:${assignment.className}`, assignment])).values()];
}
