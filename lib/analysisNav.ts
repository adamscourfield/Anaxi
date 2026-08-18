import { UserRole } from "@/lib/types";
import { hasPermission } from "@/lib/rbac";

/** Teachers directory (/explorer/teachers) — coaches with assignments included. */
export function canAccessTeacherDirectory(role: UserRole, coacheeCount = 0): boolean {
  if (hasPermission(role, "analysis:view")) return true;
  if (role === "LEADER" && coacheeCount > 0) return true;
  return false;
}
