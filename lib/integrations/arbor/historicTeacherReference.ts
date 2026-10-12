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
