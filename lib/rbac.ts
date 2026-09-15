import { UserRole } from "@/lib/types";

export const isAdmin = (role: UserRole) => role === "ADMIN";
export const canLead = (role: UserRole) => role === "LEADER" || role === "HOD" || role === "SLT" || role === "ADMIN";

export type OnCallPermission =
  | "oncall:create"
  | "oncall:acknowledge"
  | "oncall:resolve"
  | "oncall:view_all"
  | "oncall:cancel"
  | "oncall:delete"
  | "oncall:view_resolve_time";

export type StudentPermission =
  | "students:read"
  | "students:write"
  | "import:write";

export type MeetingPermission =
  | "meetings:create"
  | "meetings:view_own"
  | "meetings:view_all"
  | "meetings:edit"
  | "meetings:delete";

export type ActionPermission =
  | "actions:create"
  | "actions:manage"
  | "actions:view_own"
  | "actions:view_all";

export type ObservePermission =
  | "observe:view"
  | "observe:view_all"
  | "observe:create"
  | "observe:configure";

export type LeavePermission =
  | "leave:request"
  | "leave:approve"
  | "leave:approve_all"
  | "leave:delete";

export type AnalysisPermission =
  | "analysis:view"
  | "analysis:view_behaviour"
  | "analysis:export";

export type AdminPermission =
  | "admin:access"
  | "admin:users"
  | "admin:settings";

export type AppPermission =
  | OnCallPermission
  | StudentPermission
  | MeetingPermission
  | ActionPermission
  | ObservePermission
  | LeavePermission
  | AnalysisPermission
  | AdminPermission;

const TEACHER_PERMISSIONS: AppPermission[] = [
  "oncall:create", "oncall:cancel", "students:read",
  "meetings:create", "meetings:view_own",
  "actions:create", "actions:manage", "actions:view_own",
  "observe:view", "observe:create",
  "leave:request",
];

const ROLE_PERMISSIONS: Record<UserRole, AppPermission[]> = {
  SUPER_ADMIN: [
    "oncall:create", "oncall:acknowledge", "oncall:resolve", "oncall:view_all", "oncall:cancel", "oncall:delete", "oncall:view_resolve_time",
    "import:write", "students:read", "students:write",
    "meetings:create", "meetings:view_own", "meetings:view_all", "meetings:edit", "meetings:delete",
    "actions:create", "actions:manage", "actions:view_own", "actions:view_all",
    "observe:view", "observe:view_all", "observe:create", "observe:configure",
    "leave:request", "leave:approve", "leave:approve_all", "leave:delete",
    "analysis:view", "analysis:view_behaviour", "analysis:export",
    "admin:access", "admin:users", "admin:settings",
  ],
  ADMIN: [
    "oncall:create", "oncall:acknowledge", "oncall:resolve", "oncall:view_all", "oncall:cancel", "oncall:delete", "oncall:view_resolve_time",
    "import:write", "students:read", "students:write",
    "meetings:create", "meetings:view_own", "meetings:view_all", "meetings:edit", "meetings:delete",
    "actions:create", "actions:manage", "actions:view_own", "actions:view_all",
    "observe:view", "observe:view_all", "observe:create", "observe:configure",
    "leave:request", "leave:approve", "leave:approve_all", "leave:delete",
    "analysis:view", "analysis:view_behaviour", "analysis:export",
    "admin:access", "admin:users", "admin:settings",
  ],
  // SLT no longer gets blanket "leave:approve_all" -- global leave visibility
  // and approval is now opt-in per person (canApproveAllLoa / scoped groups),
  // same mechanism already used for HOD/HR/Leader. Existing SLT staff were
  // grandfathered in via a data migration so nobody lost access on upgrade.
  //
  // SLT also no longer gets blanket "meetings:view_all"/"meetings:edit" --
  // that let any SLT member read (and edit) every meeting in the school,
  // including other managers' private line-management notes. SLT can still
  // see and manage meetings they created or were invited to, same as any
  // other role. "actions:view_all" is kept separately so SLT retains
  // oversight of follow-up action items without also unlocking meeting notes.
  SLT: [
    "oncall:create", "oncall:acknowledge", "oncall:resolve", "oncall:view_all", "oncall:delete", "oncall:view_resolve_time",
    "import:write", "students:read", "students:write",
    "meetings:create", "meetings:view_own",
    "actions:create", "actions:manage", "actions:view_own", "actions:view_all",
    "observe:view", "observe:view_all", "observe:create",
    "leave:request", "leave:approve",
    "analysis:view", "analysis:view_behaviour", "analysis:export",
  ],
  HOD: [
    "oncall:create", "students:read",
    "meetings:create", "meetings:view_own",
    "actions:create", "actions:manage", "actions:view_own",
    "observe:view", "observe:view_all", "observe:create",
    "leave:request", "leave:approve",
    "analysis:view", "analysis:view_behaviour", "analysis:export",
  ],
  LEADER: [
    "oncall:create", "oncall:cancel", "students:read",
    "observe:view", "observe:create",
    "leave:request",
  ],
  TEACHER: TEACHER_PERMISSIONS,
  SUPPORT: TEACHER_PERMISSIONS,
  HR: [
    "oncall:create", "import:write", "students:read",
    "meetings:create", "meetings:view_own",
    "actions:view_own",
    "observe:view", "observe:create",
    "leave:request", "leave:approve", "leave:delete",
  ],
  ON_CALL: [
    "oncall:create", "oncall:acknowledge", "oncall:resolve", "oncall:view_all", "oncall:cancel",
    "meetings:view_own",
    "actions:view_own",
    "observe:view", "observe:create",
  ],
};

export function hasOnCallPermission(role: UserRole, permission: OnCallPermission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function hasPermission(role: UserRole, permission: AppPermission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function hasAnyPermission(role: UserRole, permissions: AppPermission[]): boolean {
  const allowed = ROLE_PERMISSIONS[role] ?? [];
  return permissions.some((permission) => allowed.includes(permission));
}
