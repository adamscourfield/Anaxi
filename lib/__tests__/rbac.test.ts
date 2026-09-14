import { describe, it, expect } from "vitest";
import { hasOnCallPermission, hasPermission, type AppPermission } from "@/lib/rbac";

const ALL_PERMISSIONS: AppPermission[] = [
  "oncall:create", "oncall:acknowledge", "oncall:resolve", "oncall:view_all", "oncall:cancel", "oncall:delete", "oncall:view_resolve_time",
  "students:read", "students:write", "import:write",
  "meetings:create", "meetings:view_own", "meetings:view_all", "meetings:edit", "meetings:delete",
  "actions:create", "actions:manage", "actions:view_own", "actions:view_all",
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

describe("SLT leave approval", () => {
  it("no longer has blanket leave:approve_all", () => {
    expect(hasPermission("SLT", "leave:approve_all")).toBe(false);
  });

  it("still has leave:approve (approval is granted per-person, not blocked)", () => {
    expect(hasPermission("SLT", "leave:approve")).toBe(true);
  });

  it("ADMIN and SUPER_ADMIN keep blanket leave:approve_all", () => {
    expect(hasPermission("ADMIN", "leave:approve_all")).toBe(true);
    expect(hasPermission("SUPER_ADMIN", "leave:approve_all")).toBe(true);
  });
});

describe("SLT meeting notes scoping", () => {
  it("no longer has blanket meetings:view_all or meetings:edit", () => {
    expect(hasPermission("SLT", "meetings:view_all")).toBe(false);
    expect(hasPermission("SLT", "meetings:edit")).toBe(false);
  });

  it("still has meetings:create and meetings:view_own", () => {
    expect(hasPermission("SLT", "meetings:create")).toBe(true);
    expect(hasPermission("SLT", "meetings:view_own")).toBe(true);
  });

  it("keeps actions:view_all for follow-up oversight, separate from meeting notes", () => {
    expect(hasPermission("SLT", "actions:view_all")).toBe(true);
  });

  it("ADMIN and SUPER_ADMIN keep blanket meetings:view_all and meetings:edit", () => {
    expect(hasPermission("ADMIN", "meetings:view_all")).toBe(true);
    expect(hasPermission("ADMIN", "meetings:edit")).toBe(true);
    expect(hasPermission("SUPER_ADMIN", "meetings:view_all")).toBe(true);
    expect(hasPermission("SUPER_ADMIN", "meetings:edit")).toBe(true);
  });
});

describe("observe:create is universal", () => {
  it("every role can log an observation", () => {
    const allRoles: Parameters<typeof hasPermission>[0][] = [
      "SUPER_ADMIN", "ADMIN", "SLT", "HOD", "LEADER", "TEACHER", "SUPPORT", "HR", "ON_CALL",
    ];
    for (const role of allRoles) {
      expect(hasPermission(role, "observe:create")).toBe(true);
    }
  });

  it("HR and ON_CALL can also view observations they're party to", () => {
    expect(hasPermission("HR", "observe:view")).toBe(true);
    expect(hasPermission("ON_CALL", "observe:view")).toBe(true);
  });
});

describe("oncall:view_resolve_time permission", () => {
  it("only SLT, ADMIN, and SUPER_ADMIN can see when/how fast a request was resolved", () => {
    expect(hasOnCallPermission("SLT", "oncall:view_resolve_time")).toBe(true);
    expect(hasOnCallPermission("ADMIN", "oncall:view_resolve_time")).toBe(true);
    expect(hasOnCallPermission("SUPER_ADMIN", "oncall:view_resolve_time")).toBe(true);
  });

  it("everyone else cannot", () => {
    expect(hasOnCallPermission("TEACHER", "oncall:view_resolve_time")).toBe(false);
    expect(hasOnCallPermission("SUPPORT", "oncall:view_resolve_time")).toBe(false);
    expect(hasOnCallPermission("HOD", "oncall:view_resolve_time")).toBe(false);
    expect(hasOnCallPermission("LEADER", "oncall:view_resolve_time")).toBe(false);
    expect(hasOnCallPermission("HR", "oncall:view_resolve_time")).toBe(false);
    expect(hasOnCallPermission("ON_CALL", "oncall:view_resolve_time")).toBe(false);
  });
});

describe("oncall:delete permission", () => {
  it("SLT, ADMIN, and SUPER_ADMIN can delete on-call requests", () => {
    expect(hasOnCallPermission("SLT", "oncall:delete")).toBe(true);
    expect(hasOnCallPermission("ADMIN", "oncall:delete")).toBe(true);
    expect(hasOnCallPermission("SUPER_ADMIN", "oncall:delete")).toBe(true);
  });

  it("other roles cannot delete on-call requests", () => {
    expect(hasOnCallPermission("TEACHER", "oncall:delete")).toBe(false);
    expect(hasOnCallPermission("SUPPORT", "oncall:delete")).toBe(false);
    expect(hasOnCallPermission("HOD", "oncall:delete")).toBe(false);
    expect(hasOnCallPermission("LEADER", "oncall:delete")).toBe(false);
    expect(hasOnCallPermission("HR", "oncall:delete")).toBe(false);
    expect(hasOnCallPermission("ON_CALL", "oncall:delete")).toBe(false);
  });
});
