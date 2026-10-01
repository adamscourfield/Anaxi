const ARBOR_OWNED_STAFF_FIELDS = ["fullName", "role"] as const;

type ArborOwnedStaffField = (typeof ARBOR_OWNED_STAFF_FIELDS)[number];

type StaffEditCandidate = {
  dataSource: string;
  fullName: string;
  role: string;
};

type StaffEditPayload = Partial<Pick<StaffEditCandidate, ArborOwnedStaffField>>;

export const ARBOR_STAFF_FIELD_OWNERSHIP_MESSAGE =
  "This staff member is managed by Arbor. Change their name or role in Arbor, then run a sync.";

export function getBlockedArborOwnedStaffFields(
  existing: StaffEditCandidate,
  next: StaffEditPayload,
): ArborOwnedStaffField[] {
  if (existing.dataSource !== "ARBOR") return [];

  return ARBOR_OWNED_STAFF_FIELDS.filter((field) => {
    const nextValue = next[field];
    return nextValue !== undefined && nextValue !== existing[field];
  });
}

export function assertCanEditArborOwnedStaffFields(
  existing: StaffEditCandidate,
  next: StaffEditPayload,
): void {
  const blockedFields = getBlockedArborOwnedStaffFields(existing, next);
  if (blockedFields.length > 0) {
    throw new Error(ARBOR_STAFF_FIELD_OWNERSHIP_MESSAGE);
  }
}
