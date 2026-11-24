import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { isLinkedAccount } from "@/lib/linkedAccounts";
import { ipFromHeaders } from "@/lib/loginRateLimit";

const row = (over: Partial<Parameters<typeof isLinkedAccount>[0]> = {}) => ({
  id: "u1",
  tenantId: "school-a",
  passwordHash: "$2a$10$hashA",
  microsoftTenantId: null,
  microsoftObjectId: null,
  ...over,
});

describe("isLinkedAccount", () => {
  it("treats the same account as linked", () => {
    expect(isLinkedAccount(row(), row())).toBe(true);
  });

  it("links accounts that share a password hash", () => {
    expect(isLinkedAccount(row(), row({ id: "u2", tenantId: "school-b" }))).toBe(true);
  });

  it("does not link on email alone (different password hash)", () => {
    expect(isLinkedAccount(row(), row({ id: "u2", tenantId: "school-b", passwordHash: "$2a$10$hashB" }))).toBe(false);
  });

  it("does not link a target with no password", () => {
    expect(isLinkedAccount(row(), row({ id: "u2", tenantId: "school-b", passwordHash: null }))).toBe(false);
  });

  it("does not link two password-less accounts", () => {
    expect(isLinkedAccount(row({ passwordHash: null }), row({ id: "u2", tenantId: "school-b", passwordHash: null }))).toBe(false);
  });

  it("links accounts provisioned with the same Microsoft identity", () => {
    const ms = { microsoftTenantId: "tid", microsoftObjectId: "oid", passwordHash: null };
    expect(isLinkedAccount(row(ms), row({ ...ms, id: "u2", tenantId: "school-b" }))).toBe(true);
  });

  it("for a Microsoft session, requires the Microsoft identity to match even if hashes match", () => {
    const microsoft = { tid: "tid", oid: "oid" };
    expect(isLinkedAccount(row(), row({ id: "u2", tenantId: "school-b" }), microsoft)).toBe(false);
    expect(
      isLinkedAccount(row(), row({ id: "u2", tenantId: "school-b", microsoftTenantId: "tid", microsoftObjectId: "oid" }), microsoft),
    ).toBe(true);
  });
});

describe("ipFromHeaders", () => {
  it("uses the first forwarded address", () => {
    expect(ipFromHeaders({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" })).toBe("1.2.3.4");
  });
  it("falls back to x-real-ip, then unknown", () => {
    expect(ipFromHeaders({ "x-real-ip": "5.6.7.8" })).toBe("5.6.7.8");
    expect(ipFromHeaders(undefined)).toBe("unknown");
  });
});
