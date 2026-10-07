import { describe, expect, it } from "vitest";
import { buildTimetableIdentityResolver } from "@/lib/integrations/arbor/timetableIdentity";

const people = [
  { id: "student-1", tenantId: "school-1", fullName: "Amina O'Neill", externalId: "arbor-student-1" },
  { id: "teacher-1", tenantId: "school-1", fullName: "Rezia Akhtar", externalId: "arbor-teacher-1" },
  { id: "teacher-2", tenantId: "school-1", fullName: "Same Name", externalId: null },
  { id: "teacher-3", tenantId: "school-1", fullName: "Same Name", externalId: null },
];

describe("timetable identity resolver", () => {
  it("uses the Arbor external ID before considering a name", () => {
    const resolver = buildTimetableIdentityResolver(people);

    expect(resolver.student("arbor-student-1", "A different name")).toMatchObject({
      person: { id: "student-1" },
      method: "EXTERNAL_ID",
    });
  });

  it("uses a unique normalised name only when an external ID is unavailable", () => {
    const resolver = buildTimetableIdentityResolver(people);

    expect(resolver.staff("school-1", "missing", "rezia-akhtar")).toMatchObject({
      person: { id: "teacher-1" },
      method: "UNIQUE_NAME",
    });
  });

  it("does not guess when a name matches more than one person", () => {
    const resolver = buildTimetableIdentityResolver(people);

    expect(resolver.staff("school-1", "missing", "Same Name")).toBeNull();
  });
});
