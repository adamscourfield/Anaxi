import type { ArborStudentRecord } from "./types";
import { arborYearGroupCode, routeArborStudentByAcademicLevel } from "./studentRouting";

export type ExistingAnaxiStudent = {
  id: string;
  tenantId: string;
  fullName: string;
  yearGroup: string | null;
  externalId: string | null;
  dataSource: string;
};

export type StudentSyncPlanItem = {
  action: "CREATE" | "ADOPT" | "UPDATE" | "SKIP" | "REVIEW";
  arborStudent: ArborStudentRecord;
  tenantId?: string;
  existingStudent?: ExistingAnaxiStudent;
};

function normaliseName(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function normaliseYearGroup(value: string | null | undefined): string | null {
  const raw = value?.trim().toLowerCase() ?? "";
  if (!raw) return null;
  if (raw === "n" || raw.startsWith("nursery")) return "N";
  if (raw === "reception" || raw === "r") return "R";
  const match = raw.match(/^(?:year|y)?\s*0?([1-9]|1[0-3])$/);
  return match ? `Y${Number(match[1])}` : null;
}

export function arborStudentFullName(student: ArborStudentRecord): string {
  const firstName = student.preferredFirstName?.trim() || student.legalFirstName;
  const lastName = student.preferredLastName?.trim() || student.legalLastName;
  return `${firstName} ${lastName}`.trim();
}

export function buildStudentSyncPlan(
  arborStudents: ArborStudentRecord[],
  tenantIdBySchoolType: { PRIMARY?: string; SECONDARY?: string },
  existingStudents: ExistingAnaxiStudent[]
): StudentSyncPlanItem[] {
  const linkedByExternalId = new Map<string, ExistingAnaxiStudent>();
  const candidatesByNameAndYear = new Map<string, ExistingAnaxiStudent[]>();
  for (const existing of existingStudents) {
    if (existing.dataSource === "ARBOR" && existing.externalId) {
      linkedByExternalId.set(`${existing.tenantId}\u0000${existing.externalId}`, existing);
      continue;
    }
    const yearGroup = normaliseYearGroup(existing.yearGroup);
    const name = normaliseName(existing.fullName);
    if (!yearGroup || !name) continue;
    const key = `${existing.tenantId}\u0000${name}\u0000${yearGroup}`;
    candidatesByNameAndYear.set(key, [...(candidatesByNameAndYear.get(key) ?? []), existing]);
  }

  return arborStudents.map((arborStudent) => {
    const destination = routeArborStudentByAcademicLevel(arborStudent.displayAcademicLevel?.displayName);
    if (destination === "SKIP_OFF_ROLL") return { action: "SKIP", arborStudent };
    if (destination === "REVIEW") return { action: "REVIEW", arborStudent };
    const tenantId = tenantIdBySchoolType[destination];
    const yearGroup = arborYearGroupCode(arborStudent.displayAcademicLevel?.displayName);
    if (!tenantId || !yearGroup) return { action: "REVIEW", arborStudent };
    const linked = linkedByExternalId.get(`${tenantId}\u0000${arborStudent.id}`);
    if (linked) return { action: "UPDATE", arborStudent, tenantId, existingStudent: linked };
    const candidates = candidatesByNameAndYear.get(`${tenantId}\u0000${normaliseName(arborStudentFullName(arborStudent))}\u0000${yearGroup}`) ?? [];
    if (candidates.length === 1) return { action: "ADOPT", arborStudent, tenantId, existingStudent: candidates[0] };
    if (candidates.length > 1) return { action: "REVIEW", arborStudent, tenantId };
    return { action: "CREATE", arborStudent, tenantId };
  });
}
