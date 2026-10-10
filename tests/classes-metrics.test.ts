import { describe, expect, it } from "vitest";
import { attendanceSummary, groupClassRosters } from "@/modules/classes/metrics";

describe("class data", () => {
  it("weights attendance by sessions instead of averaging rates", () => {
    expect(attendanceSummary([{ pct: 50, present: 1, possible: 2 }, { pct: 100, present: 8, possible: 8 }])).toEqual({ value: 90, weighted: true, count: 2 });
  });
  it("uses the pupil mean when some snapshots have no session totals", () => {
    expect(attendanceSummary([{ pct: 50, present: 1, possible: 2 }, { pct: 100, present: 0, possible: 0 }])).toEqual({ value: 75, weighted: false, count: 2 });
  });
  it("keeps missing and invalid attendance distinct from zero", () => {
    expect(attendanceSummary([]).value).toBeNull();
    expect(attendanceSummary([{ pct: NaN, present: 0, possible: 0 }, { pct: 101, present: 0, possible: 0 }]).count).toBe(0);
    expect(attendanceSummary([{ pct: 0, present: 0, possible: 10 }]).value).toBe(0);
  });
  it("deduplicates shared teaching and keeps a mixed-year class together", () => {
    const base = { className: " 10A ", subject: { id: "maths", name: "Maths" }, teacher: { id: "a", fullName: "Teacher A" }, student: { id: "p1", yearGroup: "Y10" } };
    const groups = groupClassRosters([base, { ...base, teacher: { id: "b", fullName: "Teacher B" } }, { ...base, student: { id: "p2", yearGroup: "Y11" } }, { ...base, className: " " }]);
    expect(groups).toHaveLength(1);
    expect([...groups[0].pupilIds]).toEqual(["p1", "p2"]);
    expect(groups[0].teachers.size).toBe(2);
    expect([...groups[0].years]).toEqual(["Y10", "Y11"]);
  });
  it("does not merge same-named classes from different subjects", () => {
    const base = { className: "7A", subject: { id: "maths", name: "Maths" }, teacher: { id: "a", fullName: "Teacher" }, student: { id: "p1", yearGroup: "Y7" } };
    expect(groupClassRosters([base, { ...base, subject: { id: "english", name: "English" } }])).toHaveLength(2);
  });
});
