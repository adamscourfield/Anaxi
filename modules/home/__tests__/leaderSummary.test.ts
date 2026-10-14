import { describe, expect, it } from "vitest";
import { buildLeaderSummary, type LeaderSummaryInput } from "../leaderSummary";
const base: LeaderSummaryInput = { attendancePct: null, studentFocusCount: null, teacherFocusCount: 0, teachersCovered: 0, focus: undefined, strength: undefined };
describe("leader summary", () => {
  it("does not turn missing evidence into an all-clear", () => {
    expect(buildLeaderSummary(base).join(" ")).toContain("not enough comparable evidence");
    expect(buildLeaderSummary(base).join(" ")).not.toContain("No teaching decline");
  });
  it("explains missing student evidence even when teaching evidence exists", () => {
    expect(buildLeaderSummary({ ...base, studentFocusEnabled: true, teachersCovered: 6 }).join(" ")).toContain("Student focus is unavailable");
  });
  it("includes an evidence-qualified student focus when none are flagged", () => {
    expect(buildLeaderSummary({ ...base, studentFocusCount: 0 }).join(" ")).toContain("No students are flagged as urgent or priority in the available snapshots");
  });
  it("omits student focus when the feature is disabled", () => {
    expect(buildLeaderSummary({ ...base, studentFocusEnabled: false, teachersCovered: 6 }).join(" ")).not.toContain("Student focus");
  });
  it("uses the existing focus counts and labels the attendance period", () => {
    const result = buildLeaderSummary({ ...base, attendancePct: 94.25, studentFocusCount: 1, teacherFocusCount: 2 }).join(" ");
    expect(result).toContain("94.3% for the academic year to date");
    expect(result).toContain("1 student needs");
    expect(result).toContain("2 teachers");
  });
  it("qualifies a clear teaching result by available evidence", () => {
    expect(buildLeaderSummary({ ...base, teachersCovered: 6 }).join(" ")).toContain("in the available evidence");
  });
});
