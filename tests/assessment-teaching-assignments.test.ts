import { describe, expect, it } from "vitest";
import { teachersForOneClass, teachingSubjectKey, historicPointDate } from "@/modules/assessments/teachingAssignments";

describe("assessment classroom teachers", () => {
  it("retains both Maths teachers sharing the same historical class", () => {
    const links = [
      { teacherId: "maths-1", className: "Mathematics: 9H/Ma (2025/2026)" },
      { teacherId: "maths-2", className: "Mathematics: 9H/Ma (2025/2026)" },
    ];
    expect(teachersForOneClass([...links, links[0]])).toEqual(links);
  });
  it("does not guess between different classes or academic years", () => {
    expect(teachersForOneClass([
      { teacherId: "previous", className: "9H/Ma (2025/2026)" },
      { teacherId: "current", className: "10H/Ma (2026/2027)" },
    ])).toEqual([]);
  });
  it("leaves missing teachers unassigned", () => {
    expect(teachersForOneClass([])).toEqual([]);
  });
});


describe("Maths subject labels", () => {
  it("matches assessment Maths to Arbor Mathematics and Math", () => {
    expect(teachingSubjectKey("Maths")).toBe(teachingSubjectKey("Mathematics"));
    expect(teachingSubjectKey("Maths")).toBe(teachingSubjectKey("Math"));
    expect(teachingSubjectKey("Maths")).toBe(teachingSubjectKey("Year 9 Mathematics"));
  });
  it("does not attribute Further Maths results to the main Maths class", () => {
    expect(teachingSubjectKey("Further Mathematics")).not.toBe(teachingSubjectKey("Maths"));
  });
});


describe("historical assessment date", () => {
  const point = { assessedAt: new Date("2026-10-11"), dateTaken: null, label: "End of Year", dataSource: "ARBOR", cycle: { academicYear: "2025/2026" } };
  it("does not use the current import date for a renamed historic point", () => {
    expect(historicPointDate(point).toISOString()).toBe("2026-06-30T00:00:00.000Z");
  });
  it("keeps the actual assessment date when it belongs to the cycle", () => {
    const dateTaken = new Date("2026-06-20");
    expect(historicPointDate({ ...point, dateTaken })).toEqual(dateTaken);
  });
  it("preserves a manual point's date", () => {
    expect(historicPointDate({ ...point, dataSource: "MANUAL" })).toEqual(point.assessedAt);
  });
});
