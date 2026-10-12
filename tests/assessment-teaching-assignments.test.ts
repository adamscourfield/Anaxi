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

import { uniqueHistoricPupilAliases, teachingClassSubjectKey, teachersForAssessmentClass } from "@/modules/assessments/teachingAssignments";

describe("uploaded pupil historical identities", () => {
  const uploaded = { id: "upload", fullName: "Alex Smith", externalId: null };
  const arbor = { id: "arbor", fullName: "Alex Smith", externalId: "123" };
  it("links an uploaded pupil without an Arbor ID to one unique Arbor roster identity", () => {
    expect(uniqueHistoricPupilAliases([uploaded], [arbor, arbor]).get("upload")).toBe("arbor");
  });
  it("matches accents and punctuation only when the full normalized name is unique", () => {
    expect(uniqueHistoricPupilAliases([{ ...uploaded, fullName: "José O’Brien" }], [{ ...arbor, fullName: "Jose O'Brien" }]).get("upload")).toBe("arbor");
  });
  it("does not turn different word boundaries into a pupil match", () => {
    expect(uniqueHistoricPupilAliases([{ ...uploaded, fullName: "Ann A Smith" }], [{ ...arbor, fullName: "Anna Smith" }]).size).toBe(0);
  });
  it("does not choose between two Arbor pupils with the same name", () => {
    expect(uniqueHistoricPupilAliases([uploaded], [arbor, { ...arbor, id: "other", externalId: "456" }]).size).toBe(0);
  });
  it("never replaces an existing external identity or matches an unnamed pupil", () => {
    expect(uniqueHistoricPupilAliases([{ ...uploaded, externalId: "456" }], [arbor]).size).toBe(0);
    expect(uniqueHistoricPupilAliases([{ ...uploaded, fullName: "" }], [{ ...arbor, fullName: "" }]).size).toBe(0);
  });
});

describe("historical subject and class evidence", () => {
  it("uses the specific subject inside Arbor's departmental class label", () => {
    expect(teachingClassSubjectKey("Art: Year 11 Fine Art: 11A/FA (2025/2026)")).toBe("fineart");
    expect(teachingClassSubjectKey("Science: Biology: Year 13: 13C/Bi (2025/2026)")).toBe("biology");
    expect(teachingClassSubjectKey("Mathematics: Year 9: 9F/Ma (2025/2026)")).toBe("maths");
  });
  it("prefers the assessed cohort's class over CCE and earlier-year groups", () => {
    const core = { teacherId: "teacher", className: "Mathematics: Year 13: 13A/Ma (2025/2026)" };
    expect(teachersForAssessmentClass([core,
      { teacherId: "support", className: "Mathematics: CCE Maths (2025/2026)" },
      { teacherId: "previous", className: "Mathematics: Year 12: 12A/Ma (2025/2026)" },
    ], "Year 13")).toEqual([core]);
  });
  it("retains a verified same-year class for mixed cohorts or early exam entries", () => {
    const link = { teacherId: "previous", className: "English: Year 12: 12D/En (2025/2026)" };
    expect(teachersForAssessmentClass([link], "13")).toEqual([link]);
  });
  it("retains separate lesson groups with the same verified teaching team", () => {
    const links = [
      { teacherId: "psychology", className: "Psychology: Year 13: 13A/Ps1 (2025/2026)" },
      { teacherId: "psychology", className: "Psychology: Year 13: 13A/Ps2 (2025/2026)" },
    ];
    expect(teachersForAssessmentClass(links, "13")).toEqual(links);
  });
  it("retains verified historical core memberships when a pupil changed classes", () => {
    const links = [
      { teacherId: "one", className: "French: Year 11: 11X1/Fr (2025/2026)" },
      { teacherId: "two", className: "French: Year 11: 11X2/Fr (2025/2026)" },
    ];
    expect(teachersForAssessmentClass(links, "11")).toEqual(links);
  });
});
