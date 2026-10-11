import { describe, expect, it } from "vitest";
import { attendanceSummary, groupClassRosters, classSubjectKey, behaviourSnapshotGroups } from "@/modules/classes/metrics";

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
    const base = { className: "10A", subject: { id: "maths", name: "Maths" }, teacher: { id: "a", fullName: "Teacher" }, student: { id: "p1", yearGroup: "Y10" } };
    expect(groupClassRosters([base, { ...base, subject: { id: "english", name: "English" } }])).toHaveLength(2);
  });
  it("combines the twelve KS3 streams across subjects without multiplying pupils", () => {
    const links = [7, 8, 9].flatMap(year => ["A", "F", "H", "S"].flatMap(stream => ["English", "Mathematics"].map(subject => ({ className: `${subject}: Year ${year}: ${year}${stream}/${subject.slice(0, 2)}`, subject: { id: subject, name: subject }, teacher: { id: subject, fullName: subject }, student: { id: `${year}${stream}`, yearGroup: `Y${year}` } }))));
    const groups = groupClassRosters(links);
    expect(groups).toHaveLength(12);
    expect(groups.every(g => g.combined && g.pupilIds.size === 1 && g.teachers.size === 2 && g.subjects.size === 2)).toBe(true);
    expect(groups.map(g => g.name)).toContain("9S");
  });
  it("matches known Arbor subject labels without merging distinct English qualifications", () => {
    expect(classSubjectKey("Mathematics")).toBe(classSubjectKey(" Maths "));
    expect(classSubjectKey("Art and Design / Art")).toBe(classSubjectKey("Art"));
    expect(classSubjectKey("Design and Technology - Graphics")).toBe(classSubjectKey("Graphics"));
    expect(classSubjectKey("English Language")).not.toBe(classSubjectKey("English Literature"));
    expect(classSubjectKey("Physics")).not.toBe(classSubjectKey("Science"));
  });

  it("never adds behaviour snapshots from different reporting periods together", () => {
    const sample = { detentionsCount: 2, onCallsCount: 1, latenessCount: 3, internalExclusionsCount: 0, suspensionsCount: 0 };
    const groups = behaviourSnapshotGroups([{ ...sample, countScope: "YEAR_TO_DATE" }, { ...sample, countScope: "YEAR_TO_DATE" }, { ...sample, detentionsCount: 9, countScope: "ROLLING_21_DAYS" }]);
    expect(groups.map(g => [g.scope, g.pupils, g.detentions])).toEqual([["YEAR_TO_DATE", 2, 4], ["ROLLING_21_DAYS", 1, 9]]);
  });

});
