import { describe, expect, it } from "vitest";
import {
  adminSectionPath,
  isAdminSectionId,
  parseAdminSection,
  sectionFromLegacyPath,
} from "@/lib/admin-sections";
import { buildAdminHubSections } from "@/lib/admin-hub-nav";

describe("admin sections", () => {
  it("parses section query param", () => {
    expect(parseAdminSection("users")).toBe("users");
    expect(parseAdminSection("bogus")).toBe("overview");
    expect(parseAdminSection(undefined)).toBe("overview");
  });

  it("builds admin URLs", () => {
    expect(adminSectionPath("overview")).toBe("/admin");
    expect(adminSectionPath("users")).toBe("/admin?section=users");
    expect(adminSectionPath("taxonomies", { tab: "loa-reasons" })).toBe(
      "/admin?section=taxonomies&tab=loa-reasons",
    );
  });

  it("maps legacy paths", () => {
    expect(sectionFromLegacyPath("/admin/departments")).toBe("departments");
    expect(sectionFromLegacyPath("/admin/users/import")).toBe("users-import");
  });

  it("knows valid section ids", () => {
    expect(isAdminSectionId("imports")).toBe(true);
    expect(isAdminSectionId("features")).toBe(false);
  });
});

describe("admin hub nav", () => {
  it("builds RBAC-filtered sections for admins", () => {
    const sections = buildAdminHubSections("ADMIN");
    const sectionIds = sections.flatMap((s) => s.items.map((i) => i.section));
    expect(sectionIds).toContain("users");
    expect(sectionIds).toContain("settings");
    expect(sectionIds).not.toContain("users-import");
  });
});
