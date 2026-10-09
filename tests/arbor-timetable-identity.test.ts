import { describe, expect, it } from "vitest";
import { buildTimetableIdentityResolver } from "@/lib/integrations/arbor/timetableIdentity";

describe("Arbor timetable identity matching", () => {
  it("retains cross-school pupil candidates for later classroom-staff disambiguation", () => {
    const resolver = buildTimetableIdentityResolver([
      { id: "secondary-pupil", tenantId: "secondary", fullName: "Alex Taylor", externalId: "arbor-42" },
      { id: "primary-pupil", tenantId: "primary", fullName: "Alex Taylor", externalId: "arbor-42" },
    ]);

    expect(resolver.student("arbor-42", "Alex Taylor")).toBeNull();
    expect(resolver.studentCandidates("arbor-42", "Alex Taylor").map((match) => match.person.tenantId)).toEqual(["secondary", "primary"]);
  });

  it("keeps staff matching scoped to the pupil's school", () => {
    const resolver = buildTimetableIdentityResolver([
      { id: "secondary-teacher", tenantId: "secondary", fullName: "Sam Teacher", externalId: "staff-7" },
      { id: "primary-teacher", tenantId: "primary", fullName: "Sam Teacher", externalId: "staff-7" },
    ]);

    expect(resolver.staff("secondary", "staff-7", "Sam Teacher")?.person.id).toBe("secondary-teacher");
    expect(resolver.staff("primary", "staff-7", "Sam Teacher")?.person.id).toBe("primary-teacher");
  });
});
