/** The one set of names for staff roles, in sentence case. Used by the header, profile, admin and meetings. */
export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super admin",
  ADMIN: "Administrator",
  SLT: "Senior leader",
  HOD: "Head of department",
  LEADER: "Leader",
  TEACHER: "Teacher",
  SUPPORT: "Support staff",
  HR: "HR officer",
  ON_CALL: "On-call staff",
};

export function formatRole(role: string | null | undefined): string {
  if (!role) return "";
  return ROLE_LABELS[role] ?? role.charAt(0) + role.slice(1).toLowerCase().replace(/_/g, " ");
}

/** Roles a school admin can assign, most senior first. Super admin is added separately where allowed. */
export const ASSIGNABLE_ROLE_OPTIONS = ["ADMIN", "SLT", "HOD", "LEADER", "TEACHER", "SUPPORT", "HR", "ON_CALL"].map((value) => ({
  value,
  label: ROLE_LABELS[value],
}));

export const SUPER_ADMIN_ROLE_OPTION = { value: "SUPER_ADMIN", label: ROLE_LABELS.SUPER_ADMIN };
