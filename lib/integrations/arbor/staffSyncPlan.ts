import type { ArborStaffRecord } from "./types";

export type ExistingAnaxiStaff = {
  id: string;
  tenantId: string;
  fullName: string;
  externalId: string | null;
  dataSource: string;
};

export type StaffSyncPlanItem = {
  action: "ADOPT" | "UPDATE" | "SKIP" | "REVIEW";
  arborStaff: ArborStaffRecord;
  existingUser?: ExistingAnaxiStaff;
};

function normaliseName(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

export function arborStaffFullName(staff: ArborStaffRecord): string {
  const firstName = staff.preferredFirstName?.trim() || staff.legalFirstName;
  const lastName = staff.preferredLastName?.trim() || staff.legalLastName;
  return `${firstName} ${lastName}`.trim();
}

/**
 * Builds one item per Anaxi user, rather than one item per Arbor staff member:
 * a staff member can legitimately have a linked account in both schools.
 */
export function buildStaffSyncPlan(
  arborStaff: ArborStaffRecord[],
  tenantIds: string[],
  existingUsers: ExistingAnaxiStaff[]
): StaffSyncPlanItem[] {
  const targetUsers = existingUsers.filter((user) => tenantIds.includes(user.tenantId) && user.fullName.trim());
  const linkedByExternalId = new Map<string, ExistingAnaxiStaff[]>();
  const candidatesByName = new Map<string, ExistingAnaxiStaff[]>();

  for (const user of targetUsers) {
    if (user.dataSource === "ARBOR" && user.externalId) {
      linkedByExternalId.set(user.externalId, [...(linkedByExternalId.get(user.externalId) ?? []), user]);
      continue;
    }
    const key = normaliseName(user.fullName);
    candidatesByName.set(key, [...(candidatesByName.get(key) ?? []), user]);
  }

  const plan: StaffSyncPlanItem[] = [];
  for (const staff of arborStaff.filter((record) => record.isActiveInSchool)) {
    const linked = linkedByExternalId.get(staff.id);
    if (linked?.length) {
      for (const user of linked) plan.push({ action: "UPDATE", arborStaff: staff, existingUser: user });
      continue;
    }

    const matches = candidatesByName.get(normaliseName(arborStaffFullName(staff))) ?? [];
    const matchesByTenant = new Map<string, ExistingAnaxiStaff[]>();
    for (const user of matches) matchesByTenant.set(user.tenantId, [...(matchesByTenant.get(user.tenantId) ?? []), user]);
    if ([...matchesByTenant.values()].some((users) => users.length > 1)) {
      plan.push({ action: "REVIEW", arborStaff: staff });
    } else if (matches.length) {
      for (const user of matches) plan.push({ action: "ADOPT", arborStaff: staff, existingUser: user });
    } else {
      plan.push({ action: "SKIP", arborStaff: staff });
    }
  }
  return plan;
}
