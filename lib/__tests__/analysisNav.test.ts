import { describe, expect, it } from "vitest";
import { canAccessTeacherDirectory } from "@/lib/analysisNav";

describe("analysisNav", () => {
  it("allows coaches with coachees to reach the teacher directory", () => {
    expect(canAccessTeacherDirectory("LEADER", 2)).toBe(true);
  });

  it("blocks coaches without coachees from teacher directory", () => {
    expect(canAccessTeacherDirectory("LEADER", 0)).toBe(false);
  });

  it("allows SLT via analysis permission", () => {
    expect(canAccessTeacherDirectory("SLT", 0)).toBe(true);
  });
});
