import { describe, expect, it } from "vitest";
import { historicTeacherReference } from "@/lib/integrations/arbor/historicTeacherReference";

describe("historical Arbor teacher reporting references", () => {
  it("retains the MIS identity without granting access or enabling notifications", () => {
    expect(historicTeacherReference("secondary", { id: "891", fullName: "Former Teacher" })).toMatchObject({
      tenantId: "secondary", externalId: "891", fullName: "Former Teacher", dataSource: "ARBOR",
      isActive: false, passwordHash: null, emailObservations: false, emailMeetings: false, emailLeave: false,
      receivesOnCallEmails: false, receivesFirstAidEmails: false,
    });
  });
  it("uses a deterministic non-deliverable address without assuming a former teacher's email", () => {
    const first = historicTeacherReference("secondary", { id: "staff/891", fullName: "Former Teacher" });
    expect(first.email).toMatch(/^arbor-history-[a-f0-9]+@history\.invalid$/);
    expect(first.email).toBe(historicTeacherReference("secondary", { id: "staff/891", fullName: "Changed Name" }).email);
  });
});
