import { describe, expect, it } from "vitest";
import { decideUrlSectionSync, shouldShowPanelSkeleton } from "@/lib/admin-workspace-nav";

describe("decideUrlSectionSync", () => {
  it("applies when URL matches the section the user selected", () => {
    expect(decideUrlSectionSync("users", "users", "users")).toBe("apply");
    expect(decideUrlSectionSync("users", "users", null)).toBe("apply");
  });

  it("ignores stale URL updates while a newer navigation is in flight", () => {
    expect(decideUrlSectionSync("coaching", "users", "users")).toBe("ignore-stale");
  });

  it("treats unmatched URL as external when nothing is in flight", () => {
    expect(decideUrlSectionSync("settings", "users", null)).toBe("external");
  });
});

describe("shouldShowPanelSkeleton", () => {
  it("shows skeleton only while loading an uncached section", () => {
    expect(shouldShowPanelSkeleton(false, true)).toBe(true);
    expect(shouldShowPanelSkeleton(true, true)).toBe(false);
    expect(shouldShowPanelSkeleton(false, false)).toBe(false);
  });
});
