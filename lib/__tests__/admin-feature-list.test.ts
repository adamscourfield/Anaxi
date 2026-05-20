import { describe, expect, it } from "vitest";
import { buildTenantFeatureList } from "@/lib/admin-feature-list";
import { ALL_FEATURE_KEYS } from "@/lib/types";

describe("buildTenantFeatureList", () => {
  it("includes every canonical feature key", () => {
    const list = buildTenantFeatureList([{ key: "LEAVE", enabled: true }]);
    for (const key of ALL_FEATURE_KEYS) {
      expect(list.some((row) => row.key === key)).toBe(true);
    }
  });

  it("preserves enabled flags from the database", () => {
    const list = buildTenantFeatureList([
      { key: "LEAVE", enabled: true },
      { key: "CUSTOM_LEGACY", enabled: true },
    ]);
    expect(list.find((row) => row.key === "LEAVE")?.enabled).toBe(true);
    expect(list.find((row) => row.key === "OBSERVATIONS")?.enabled).toBe(false);
    expect(list.find((row) => row.key === "CUSTOM_LEGACY")?.enabled).toBe(true);
  });
});
