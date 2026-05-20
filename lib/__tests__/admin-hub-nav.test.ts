import { describe, expect, it } from "vitest";
import {
  buildAdminHubSections,
  isAdminHubExcludedPath,
  isAdminHubNavActive,
} from "@/lib/admin-hub-nav";

describe("admin hub nav", () => {
  it("marks overview only on /admin", () => {
    expect(isAdminHubNavActive("/admin", "/admin")).toBe(true);
    expect(isAdminHubNavActive("/admin/users", "/admin")).toBe(false);
    expect(isAdminHubNavActive("/admin/users", "/admin/users")).toBe(true);
    expect(isAdminHubNavActive("/admin/users/import", "/admin/users")).toBe(true);
  });

  it("excludes feature flags from hub chrome", () => {
    expect(isAdminHubExcludedPath("/admin/features")).toBe(true);
    expect(isAdminHubExcludedPath("/admin/users")).toBe(false);
  });

  it("builds RBAC-filtered sections for admins", () => {
    const sections = buildAdminHubSections("ADMIN");
    const hrefs = sections.flatMap((s) => s.items.map((i) => i.href));
    expect(hrefs).toContain("/admin/users");
    expect(hrefs).toContain("/admin/settings");
    expect(hrefs).not.toContain("/admin/features");
  });
});
