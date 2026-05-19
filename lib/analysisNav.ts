import { UserRole } from "@/lib/types";
import { hasAnyPermission, hasPermission } from "@/lib/rbac";

/** Sidebar / route access to Priorities (/analytics) and teacher tables. */
export function canAccessPrioritiesNav(role: UserRole, coacheeCount = 0): boolean {
  if (hasAnyPermission(role, ["analysis:view", "analysis:export"])) return true;
  if (role === "TEACHER") return true;
  if (role === "LEADER" && coacheeCount > 0) return true;
  return false;
}

/** Teachers directory (/instruction/teachers) — coaches with assignments included. */
export function canAccessTeacherDirectory(role: UserRole, coacheeCount = 0): boolean {
  if (hasPermission(role, "analysis:view")) return true;
  if (role === "LEADER" && coacheeCount > 0) return true;
  return false;
}
