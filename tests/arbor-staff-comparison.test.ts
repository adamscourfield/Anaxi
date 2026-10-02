import { describe, expect, it } from "vitest";
import { compareArborStaff } from "@/lib/integrations/arbor/staffComparison";

const staff = (id: string, firstName: string) => ({ id, legalFirstName: firstName, legalLastName: "Smith", preferredFirstName: null, preferredLastName: null, joiningDate: null, leavingDate: null, staffNumber: null, isActiveInSchool: true, isActiveTeachingInSchool: true, displayJobTitle: null, emailAddresses: [] });

describe("Arbor staff comparison", () => {
  it("recognises a cross-school existing link and a possible one-school match", () => {
    const result = compareArborStaff([staff("linked", "Ada"), staff("possible", "Ben")], { PRIMARY: "p", SECONDARY: "s" }, [
      { tenantId: "p", fullName: "Ada Smith", externalId: "linked", dataSource: "ARBOR", isActive: true },
      { tenantId: "s", fullName: "Ada Smith", externalId: "linked", dataSource: "ARBOR", isActive: true },
      { tenantId: "p", fullName: "Ben Smith", externalId: null, dataSource: "MANUAL", isActive: true },
    ]);
    expect(result.linkedBoth).toBe(1);
    expect(result.possiblePrimaryOnly).toBe(1);
  });
});
