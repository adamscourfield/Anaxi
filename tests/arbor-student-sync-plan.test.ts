import { describe, expect, it } from "vitest";
import { buildStudentSyncPlan } from "@/lib/integrations/arbor/studentSyncPlan";

const student = (id: string, name: string, level: string | null) => ({
  id,
  legalFirstName: name,
  legalLastName: "Smith",
  preferredFirstName: null,
  preferredLastName: null,
  dateOfBirth: null,
  mostRecentEntryDate: null,
  leavingDate: null,
  displayAcademicLevel: level ? { displayName: level } : null,
  senStatusAssignments: [],
});

describe("Arbor student sync plan", () => {
  it("creates, adopts, updates, and skips without adopting ambiguous matches", () => {
    const plan = buildStudentSyncPlan(
      [student("linked", "Ada", "Year 7"), student("adopt", "Ben", "Year 8"), student("new", "Cara", "Year 9"), student("old", "Dan", null), student("ambiguous", "Eve", "Year 10")],
      { SECONDARY: "secondary" },
      [
        { id: "a", tenantId: "secondary", fullName: "Ada Smith", yearGroup: "Y7", externalId: "linked", dataSource: "ARBOR" },
        { id: "b", tenantId: "secondary", fullName: "Ben Smith", yearGroup: "8", externalId: null, dataSource: "CSV_IMPORT" },
        { id: "c", tenantId: "secondary", fullName: "Eve Smith", yearGroup: "Y10", externalId: null, dataSource: "MANUAL" },
        { id: "d", tenantId: "secondary", fullName: "Eve Smith", yearGroup: "10", externalId: null, dataSource: "MANUAL" },
      ]
    );

    expect(plan.map((item) => item.action)).toEqual(["UPDATE", "ADOPT", "CREATE", "SKIP", "REVIEW"]);
  });
});
