import { beforeEach, describe, expect, it, vi } from "vitest";
const { findFirst } = vi.hoisted(() => ({ findFirst: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findFirst } } }));
import { microsoftEnabled, resolveMicrosoftUser } from "@/lib/microsoftAuth";

describe("Microsoft sign-in", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });
  it("requires both client credentials", () => {
    vi.stubEnv("MICROSOFT_CLIENT_ID", "app");
    vi.stubEnv("MICROSOFT_CLIENT_SECRET", "");
    expect(microsoftEnabled()).toBe(false);
    vi.stubEnv("MICROSOFT_CLIENT_SECRET", "secret");
    expect(microsoftEnabled()).toBe(true);
  });
  it.each([undefined, {}, { email: "staff@school.org" }, { tid: "school", oid: "" }, { tid: 1, oid: "user" }])("rejects missing identity %j", async profile => {
    expect(await resolveMicrosoftUser(profile)).toBeNull();
    expect(findFirst).not.toHaveBeenCalled();
  });
  it("requires a provisioned active staff identity, never an email match", async () => {
    findFirst.mockResolvedValue(null);
    expect(await resolveMicrosoftUser({ tid: "directory", oid: "object", email: "admin@school.org" })).toBeNull();
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      microsoftTenantId: "directory", microsoftObjectId: "object", isActive: true,
      role: { not: "SUPER_ADMIN" }, email: { not: "hi@anaxi.io", mode: "insensitive" },
    }) }));
  });
  it("returns the existing local permissions", async () => {
    const staff = { id: "local", tenantId: "school", role: "TEACHER" };
    findFirst.mockResolvedValue(staff);
    expect(await resolveMicrosoftUser({ tid: "directory", oid: "object", roles: ["ADMIN"] })).toEqual(staff);
  });
});
