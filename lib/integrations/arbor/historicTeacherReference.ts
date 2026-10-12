/** Historical MIS identities are reporting references, never provisioned accounts. */
export function historicTeacherReference(tenantId: string, staff: { id: string; fullName: string }) {
  return {
    tenantId,
    externalId: staff.id,
    fullName: staff.fullName,
    email: `arbor-history-${Buffer.from(staff.id).toString("hex")}@history.invalid`,
    dataSource: "ARBOR" as const,
    role: "TEACHER" as const,
    isActive: false,
    passwordHash: null,
    emailObservations: false,
    emailMeetings: false,
    emailLeave: false,
    receivesOnCallEmails: false,
    receivesFirstAidEmails: false,
  };
}

/** Explicit historical class year disambiguates a shared Primary/Secondary MIS. */
export function historicClassSchoolType(className: string): "PRIMARY" | "SECONDARY" | null {
  const match = /\bYear\s+(\d{1,2})\b/i.exec(className);
  if (!match) return null;
  const year = Number(match[1]);
  return year >= 1 && year <= 6 ? "PRIMARY" : year >= 7 && year <= 13 ? "SECONDARY" : null;
}
