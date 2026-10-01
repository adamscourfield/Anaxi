import type { ArborStudentRecord } from "./types";
import { routeArborStudentByAcademicLevel } from "./studentRouting";

type ExistingStudent = {
  tenantId: string;
  fullName: string;
  yearGroup: string | null;
  externalId: string | null;
  dataSource: string;
};

export type ArborStudentComparison = {
  alreadyLinked: number;
  possibleMatch: number;
  ambiguousMatch: number;
  newStudent: number;
  skippedOffRoll: number;
  needsReview: number;
};

function normaliseName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normaliseYearGroup(value: string | null | undefined): string | null {
  const raw = value?.trim().toLowerCase() ?? "";
  if (!raw) return null;
  if (raw === "n" || raw.startsWith("nursery")) return "N";
  if (raw === "reception" || raw === "r") return "R";
  const match = raw.match(/^(?:year|y)?\s*0?([1-9]|1[0-3])$/);
  return match ? `Y${Number(match[1])}` : null;
}

function arborDisplayName(student: ArborStudentRecord): string {
  const firstName = student.preferredFirstName?.trim() || student.legalFirstName;
  const lastName = student.preferredLastName?.trim() || student.legalLastName;
  return `${firstName} ${lastName}`;
}

/**
 * Classifies records without writing data. Manual/CSV name matches are only
 * possible matches: a future import must never adopt them automatically.
 */
export function compareArborStudents(
  arborStudents: ArborStudentRecord[],
  tenantIdBySchoolType: { PRIMARY?: string; SECONDARY?: string },
  existingStudents: ExistingStudent[]
): ArborStudentComparison {
  const result: ArborStudentComparison = {
    alreadyLinked: 0,
    possibleMatch: 0,
    ambiguousMatch: 0,
    newStudent: 0,
    skippedOffRoll: 0,
    needsReview: 0,
  };
  const linked = new Set(
    existingStudents
      .filter((student) => student.dataSource === "ARBOR" && student.externalId)
      .map((student) => `${student.tenantId}\u0000${student.externalId}`)
  );
  const existingByNameAndYear = new Map<string, number>();
  for (const student of existingStudents) {
    const yearGroup = normaliseYearGroup(student.yearGroup);
    const name = normaliseName(student.fullName);
    if (!yearGroup || !name) continue;
    const key = `${student.tenantId}\u0000${name}\u0000${yearGroup}`;
    existingByNameAndYear.set(key, (existingByNameAndYear.get(key) ?? 0) + 1);
  }

  for (const student of arborStudents) {
    const schoolType = routeArborStudentByAcademicLevel(student.displayAcademicLevel?.displayName);
    if (schoolType === "SKIP_OFF_ROLL") {
      result.skippedOffRoll++;
      continue;
    }
    if (schoolType === "REVIEW") {
      result.needsReview++;
      continue;
    }

    const tenantId = tenantIdBySchoolType[schoolType];
    const yearGroup = normaliseYearGroup(student.displayAcademicLevel?.displayName);
    if (!tenantId || !yearGroup) {
      result.needsReview++;
      continue;
    }
    if (linked.has(`${tenantId}\u0000${student.id}`)) {
      result.alreadyLinked++;
      continue;
    }

    const matchCount = existingByNameAndYear.get(`${tenantId}\u0000${normaliseName(arborDisplayName(student))}\u0000${yearGroup}`) ?? 0;
    if (matchCount === 1) result.possibleMatch++;
    else if (matchCount > 1) result.ambiguousMatch++;
    else result.newStudent++;
  }

  return result;
}
