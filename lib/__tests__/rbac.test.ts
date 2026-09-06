import { describe, it, expect } from "vitest";
import { hasPermission, type AppPermission } from "@/lib/rbac";

const ALL_PERMISSIONS: AppPermission[] = [
  "oncall:create", "oncall:acknowledge", "oncall:resolve", "oncall:view_all", "oncall:cancel",
  "students:read", "students:write", "import:write",
  "meetings:create", "meetings:view_own", "meetings:view_all", "meetings:edit", "meetings:delete",
  "actions:create", "actions:manage", "actions:view_own",
  "observe:view", "observe:view_all", "observe:create", "observe:configure",
  "leave:request", "leave:approve", "leave:approve_all",
  "analysis:view", "analysis:view_behaviour", "analysis:export",
  "admin:access", "admin:users", "admin:settings",
];

describe("SUPPORT role", () => {
  it("has exactly the same permissions as TEACHER", () => {
    for (const permission of ALL_PERMISSIONS) {
      expect(hasPermission("SUPPORT", permission)).toBe(hasPermission("TEACHER", permission));
    }
  });
});
