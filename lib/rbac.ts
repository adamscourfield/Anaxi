import { UserRole } from "@/lib/types";

export const isAdmin = (role: UserRole) => role === "ADMIN";
export const canLead = (role: UserRole) => role === "LEADER" || role === "HOD" || role === "SLT" || role === "ADMIN";

export type OnCallPermission =
  | "oncall:create"
  | "oncall:acknowledge"
  | "oncall:resolve"
  | "oncall:view_all"
  | "oncall:cancel";

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
  | "actions:view_own";

export type ObservePermission =
  | "observe:view"
  | "observe:view_all"
  | "observe:create"
  | "observe:configure";

export type LeavePermission =
  | "leave:request"
  | "leave:approve"
  | "leave:approve_all";

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

const ROLE_PERMISSIONS: Record<UserRole, AppPermission[]> = {
  SUPER_ADMIN: [
    "oncall:create", "oncall:acknowledge", "oncall:resolve", "oncall:view_all", "oncall:cancel",
    "import:write", "students:read", "students:write",
    "meetings:create", "meetings:view_own", "meetings:view_all", "meetings:edit", "meetings:delete",
    "actions:create", "actions:manage", "actions:view_own",
    "observe:view", "observe:view_all", "observe:create", "observe:configure",
    "leave:request", "leave:approve", "leave:approve_all",
    "analysis:view", "analysis:view_behaviour", "analysis:export",
    "admin:access", "admin:users", "admin:settings",
  ],
  ADMIN: [
    "oncall:create", "oncall:acknowledge", "oncall:resolve", "oncall:view_all", "oncall:cancel",
    "import:write", "students:read", "students:write",
    "meetings:create", "meetings:view_own", "meetings:view_all", "meetings:edit", "meetings:delete",
    "actions:create", "actions:manage", "actions:view_own",
    "observe:view", "observe:view_all", "observe:create", "observe:configure",
    "leave:request", "leave:approve", "leave:approve_all",
    "analysis:view", "analysis:view_behaviour", "analysis:export",
    "admin:access", "admin:users", "admin:settings",
  ],
  SLT: [
    "oncall:create", "oncall:acknowledge", "oncall:resolve", "oncall:view_all",
    "import:write", "students:read", "students:write",
    "meetings:create", "meetings:view_all", "meetings:edit",
    "actions:create", "actions:manage", "actions:view_own",
    "observe:view", "observe:view_all", "observe:create",
    "leave:request", "leave:approve", "leave:approve_all",
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
  TEACHER: [
    "oncall:create", "oncall:cancel", "students:read",
    "meetings:create", "meetings:view_own",
    "actions:create", "actions:manage", "actions:view_own",
    "observe:view", "observe:create",
    "leave:request",
  ],
  HR: [
    "oncall:create", "import:write", "students:read",
    "meetings:create", "meetings:view_own",
    "actions:view_own",
    "leave:request", "leave:approve",
  ],
  ON_CALL: [
    "oncall:acknowledge", "oncall:resolve", "oncall:view_all",
    "meetings:view_own",
    "actions:view_own",
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
