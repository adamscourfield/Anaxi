import { describe, expect, it } from "vitest";
import { buildStaffSyncPlan } from "@/lib/integrations/arbor/staffSyncPlan";

const staff = (id: string, firstName: string) => ({ id, legalFirstName: firstName, legalLastName: "Smith", preferredFirstName: null, preferredLastName: null, joiningDate: null, leavingDate: null, staffNumber: null, isActiveInSchool: true, isActiveTeachingInSchool: true, displayJobTitle: null, emailAddresses: [] });

describe("Arbor staff sync plan", () => {
  it("adopts exact matches in both schools and leaves unmatched staff alone", () => {
    const plan = buildStaffSyncPlan([staff("ada", "Ada"), staff("ben", "Ben")], ["primary", "secondary"], [
      { id: "p-ada", tenantId: "primary", fullName: "Ada Smith", externalId: null, dataSource: "MANUAL" },
      { id: "s-ada", tenantId: "secondary", fullName: "Ada Smith", externalId: null, dataSource: "MANUAL" },
    ]);
    expect(plan.filter((item) => item.action === "ADOPT")).toHaveLength(2);
    expect(plan.filter((item) => item.action === "SKIP")).toHaveLength(1);
  });

  it("updates previously linked staff without re-matching names", () => {
    const plan = buildStaffSyncPlan([staff("ada", "Ada")], ["primary"], [
      { id: "p-ada", tenantId: "primary", fullName: "A. Smith", externalId: "ada", dataSource: "ARBOR" },
    ]);
    expect(plan).toMatchObject([{ action: "UPDATE", existingUser: { id: "p-ada" } }]);
  });
});
