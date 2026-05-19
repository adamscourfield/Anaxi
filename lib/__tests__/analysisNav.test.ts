import { describe, expect, it } from "vitest";
import { canAccessPrioritiesNav, canAccessTeacherDirectory } from "@/lib/analysisNav";

describe("analysisNav", () => {
  it("allows coaches with coachees to reach priorities and teachers", () => {
    expect(canAccessPrioritiesNav("LEADER", 2)).toBe(true);
    expect(canAccessTeacherDirectory("LEADER", 2)).toBe(true);
  });

  it("blocks coaches without coachees from teacher directory", () => {
    expect(canAccessPrioritiesNav("LEADER", 0)).toBe(false);
    expect(canAccessTeacherDirectory("LEADER", 0)).toBe(false);
  });

  it("allows SLT via analysis permission", () => {
    expect(canAccessPrioritiesNav("SLT", 0)).toBe(true);
    expect(canAccessTeacherDirectory("SLT", 0)).toBe(true);
  });
});
