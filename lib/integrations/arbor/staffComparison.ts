import type { ArborStaffRecord } from "./types";

type ExistingUser = { tenantId: string; fullName: string; externalId: string | null; dataSource: string; isActive: boolean };

export type StaffComparison = {
  activeInArbor: number;
  linkedPrimaryOnly: number;
  linkedSecondaryOnly: number;
  linkedBoth: number;
  possiblePrimaryOnly: number;
  possibleSecondaryOnly: number;
  possibleBoth: number;
  unmatched: number;
  ambiguous: number;
};

function name(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function staffName(staff: ArborStaffRecord) {
  return `${staff.preferredFirstName?.trim() || staff.legalFirstName} ${staff.preferredLastName?.trim() || staff.legalLastName}`.trim();
}

/** Read-only matching. Name matches are suggestions only and are never auto-adopted. */
export function compareArborStaff(
  staff: ArborStaffRecord[],
  tenantIdBySchoolType: { PRIMARY?: string; SECONDARY?: string },
  users: ExistingUser[]
): StaffComparison {
  const result: StaffComparison = { activeInArbor: 0, linkedPrimaryOnly: 0, linkedSecondaryOnly: 0, linkedBoth: 0, possiblePrimaryOnly: 0, possibleSecondaryOnly: 0, possibleBoth: 0, unmatched: 0, ambiguous: 0 };
  const linked = new Map<string, ExistingUser[]>();
  const byName = new Map<string, ExistingUser[]>();
  for (const user of users.filter((user) => user.isActive)) {
    if (user.dataSource === "ARBOR" && user.externalId) linked.set(user.externalId, [...(linked.get(user.externalId) ?? []), user]);
    byName.set(name(user.fullName), [...(byName.get(name(user.fullName)) ?? []), user]);
  }
  const classify = (matches: ExistingUser[], prefix: "linked" | "possible") => {
    const primary = matches.filter((user) => user.tenantId === tenantIdBySchoolType.PRIMARY).length;
    const secondary = matches.filter((user) => user.tenantId === tenantIdBySchoolType.SECONDARY).length;
    if (primary > 1 || secondary > 1) { result.ambiguous++; return; }
    if (primary && secondary) {
      if (prefix === "linked") result.linkedBoth++;
      else result.possibleBoth++;
    } else if (primary) {
      if (prefix === "linked") result.linkedPrimaryOnly++;
      else result.possiblePrimaryOnly++;
    } else if (secondary) {
      if (prefix === "linked") result.linkedSecondaryOnly++;
      else result.possibleSecondaryOnly++;
    } else {
      result.unmatched++;
    }
  };
  for (const record of staff.filter((record) => record.isActiveInSchool)) {
    result.activeInArbor++;
    const existingLink = linked.get(record.id);
    if (existingLink?.length) classify(existingLink, "linked");
    else {
      const matches = byName.get(name(staffName(record))) ?? [];
      if (matches.length) classify(matches, "possible");
      else result.unmatched++;
    }
  }
  return result;
}
