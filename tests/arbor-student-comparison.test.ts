import { describe, expect, it } from "vitest";
import { compareArborStudents } from "@/lib/integrations/arbor/studentComparison";

const student = (id: string, firstName: string, year: string | null) => ({
  id,
  legalFirstName: firstName,
  legalLastName: "Smith",
  preferredFirstName: null,
  preferredLastName: null,
  dateOfBirth: null,
  mostRecentEntryDate: null,
  leavingDate: null,
  displayAcademicLevel: year ? { displayName: year } : null,
  senStatusAssignments: [],
});

describe("Arbor student comparison", () => {
  it("keeps existing Arbor links separate from manual possible matches", () => {
    const result = compareArborStudents(
      [student("arbor-linked", "Ada", "Year 7"), student("manual", "Ben", "Year 8"), student("new", "Cara", "Year 9"), student("old", "Dan", null)],
      { SECONDARY: "secondary" },
      [
        { tenantId: "secondary", fullName: "Ada Smith", yearGroup: "Y7", externalId: "arbor-linked", dataSource: "ARBOR" },
        { tenantId: "secondary", fullName: "Ben Smith", yearGroup: "8", externalId: null, dataSource: "CSV_IMPORT" },
      ]
    );

    expect(result).toEqual({ alreadyLinked: 1, possibleMatch: 1, ambiguousMatch: 0, newStudent: 1, skippedOffRoll: 1, needsReview: 0 });
  });

  it("marks duplicate manual candidates as ambiguous", () => {
    const result = compareArborStudents(
      [student("arbor-1", "Ada", "Year 7")],
      { SECONDARY: "secondary" },
      [
        { tenantId: "secondary", fullName: "Ada Smith", yearGroup: "Y7", externalId: null, dataSource: "MANUAL" },
        { tenantId: "secondary", fullName: "Ada Smith", yearGroup: "7", externalId: null, dataSource: "MANUAL" },
      ]
    );

    expect(result.ambiguousMatch).toBe(1);
  });
});
