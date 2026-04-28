import { beforeEach, describe, expect, it, vi } from "vitest";
import { assertAdminCanMutateUser, assertAdminCannotAssignSuperAdminRole } from "@/lib/admin";
import type { SessionUser } from "@/lib/types";

const { findFirst } = vi.hoisted(() => ({ findFirst: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findFirst } },
}));

function session(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: "actor-1",
    tenantId: "t1",
    email: "a@x.com",
    fullName: "Actor",
    role: "ADMIN",
    isActive: true,
    ...overrides,
  };
}

beforeEach(() => {
  findFirst.mockReset();
});

describe("assertAdminCannotAssignSuperAdminRole", () => {
  it("rejects when tenant admin assigns SUPER_ADMIN", () => {
    expect(() => assertAdminCannotAssignSuperAdminRole(session(), "SUPER_ADMIN")).toThrow("FORBIDDEN");
  });

  it("allows platform super admin to assign SUPER_ADMIN", () => {
    expect(() => assertAdminCannotAssignSuperAdminRole(session({ role: "SUPER_ADMIN" }), "SUPER_ADMIN")).not.toThrow();
  });
});

describe("assertAdminCanMutateUser", () => {
  it("rejects when target is SUPER_ADMIN and actor is tenant admin", async () => {
    findFirst.mockResolvedValue({ role: "SUPER_ADMIN" });
    await expect(assertAdminCanMutateUser(session(), "u1", "t1")).rejects.toThrow("FORBIDDEN");
  });

  it("allows when target is not SUPER_ADMIN", async () => {
    findFirst.mockResolvedValue({ role: "TEACHER" });
    await expect(assertAdminCanMutateUser(session(), "u1", "t1")).resolves.toBeUndefined();
  });

  it("skips check when actor is platform super admin", async () => {
    await expect(assertAdminCanMutateUser(session({ role: "SUPER_ADMIN" }), "u1", "t1")).resolves.toBeUndefined();
    expect(findFirst).not.toHaveBeenCalled();
  });
});
