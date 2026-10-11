import { beforeEach, describe, expect, it, vi } from "vitest";
import { ArborClient } from "@/lib/integrations/arbor/client";
import { runArborGraphqlQuery } from "@/lib/integrations/arbor/graphqlClient";

vi.mock("@/lib/integrations/arbor/graphqlClient", () => ({ runArborGraphqlQuery: vi.fn() }));
const query = vi.mocked(runArborGraphqlQuery);
const person = (id: string) => ({ id, legalFirstName: id, legalLastName: "Teacher", preferredFirstName: null, preferredLastName: null });
const allocation = (id: string, effectiveDate: string | null) => ({ effectiveDate, endDate: null, staff: person(id) });
const enrolment = (records: unknown[]) => ({
  startDate: "2025-09-01", endDate: "2026-07-20", student: person("pupil"),
  academicUnit: { id: "class", displayName: "Mathematics: 9H/Ma (2025/2026)", subject: { displayName: "Mathematics" }, timetableSlots: [{ id: "maths-slot", effectiveDate: "2025-09-01", endDate: "2026-07-20", timetableSlotStaff: records }] },
});
const client = () => new ArborClient({ schoolHostname: "test", username: "test", password: "test" });
beforeEach(() => query.mockReset());
function filters() {
  query.mockResolvedValueOnce({ __schema: { queryType: { fields: [{ name: "AcademicUnitEnrolment", args: [{ name: "startDate_before_or_equal" }, { name: "endDate_after_or_equal" }] }] } } });
}

describe("dated Arbor historical timetable", () => {
  it("reads exact class lesson allocations and excludes current staff", async () => {
    filters();
    query.mockResolvedValueOnce({ AcademicUnitEnrolment: [enrolment([allocation("previous-1", "2025-09-01"), allocation("previous-2", "2025-09-01"), allocation("current", "2026-09-01")])] });
    const batch = await client().listHistoricTimetableTeacherAssignmentsBatch("2026-06-30", 0, false);
    expect(query.mock.calls[1][1]).toContain("timetableSlotStaff {");
    expect(query.mock.calls[1][1]).toContain("effectiveDate endDate");
    expect(query.mock.calls[1][1]).not.toContain("timetabledStaffByDateRange");
    expect(query.mock.calls[1][1]).toContain('startDate_before_or_equal: "2026-06-30"');
    expect(batch.assignments[0].staff.map((teacher) => teacher.id)).toEqual(["previous-1", "previous-2"]);
  });
  it("leaves the class unassigned when there are no dated staff records", async () => {
    filters();
    const row = enrolment([allocation("undated", null)]);
    row.academicUnit.timetableSlots[0].endDate = null as unknown as string;
    query.mockResolvedValueOnce({ AcademicUnitEnrolment: [row] });
    const batch = await client().listHistoricTimetableTeacherAssignmentsBatch("2026-06-30", 0, false);
    expect(batch.assignments).toEqual([]);
    expect(batch.diagnostics.staffedClasses).toBe(0);
  });
  it("fails without importing a partial roster if the staff source cannot be read", async () => {
    filters();
    query.mockRejectedValueOnce(new Error("TimetableSlotStaff permission denied"));
    await expect(client().listHistoricTimetableTeacherAssignmentsBatch("2026-06-30", 0, false)).rejects.toThrow("permission denied");
  });
  it("excludes current pupil enrolments even if Arbor does not apply the filters", async () => {
    filters();
    query.mockResolvedValueOnce({ AcademicUnitEnrolment: [{ ...enrolment([allocation("previous", "2025-09-01")]), startDate: "2026-09-01", endDate: null }] });
    expect((await client().listHistoricTimetableTeacherAssignmentsBatch("2026-06-30", 0, false)).assignments).toEqual([]);
  });
  it("does not duplicate a teacher across repeated lessons", async () => {
    filters();
    const row = enrolment([allocation("previous", "2025-09-01")]);
    row.academicUnit.timetableSlots.push(row.academicUnit.timetableSlots[0]);
    query.mockResolvedValueOnce({ AcademicUnitEnrolment: [row] });
    const batch = await client().listHistoricTimetableTeacherAssignmentsBatch("2026-06-30", 0, false);
    expect(batch.assignments[0].staff).toHaveLength(1);
  });
});


it("uses closed previous-year lesson dates when a Maths allocation inherits them", async () => {
  filters();
  query.mockResolvedValueOnce({ AcademicUnitEnrolment: [enrolment([allocation("historic-maths", null)])] });
  const batch = await client().listHistoricTimetableTeacherAssignmentsBatch("2026-06-30", 0, false);
  expect(batch.assignments[0].staff.map((teacher) => teacher.id)).toEqual(["historic-maths"]);
});
