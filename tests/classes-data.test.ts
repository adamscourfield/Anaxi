import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ links: vi.fn(), incidents: vi.fn(), results: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: { studentSubjectTeacher: { findMany: mocks.links }, behaviourIncident: { groupBy: mocks.incidents }, assessmentResult: { findMany: mocks.results } } }));
import { loadClasses } from "@/modules/classes/data";

describe("school class queries", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.incidents.mockResolvedValue([]); mocks.results.mockResolvedValue([]); });
  it("scopes all data to the school and only current active memberships", async () => {
    mocks.links.mockResolvedValue([{ className: "7A", subject: { id: "maths", name: "Maths" }, teacher: { id: "t1", fullName: "Teacher" }, student: { id: "p1", fullName: "Pupil", yearGroup: "Y7", snapshots: [] } }]);
    const data = await loadClasses("school-a", 21);
    const query = mocks.links.mock.calls[0][0];
    expect(query.where).toMatchObject({ tenantId: "school-a", student: { status: "ACTIVE" }, effectiveFrom: { lte: expect.any(Date) }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: expect.any(Date) } }] });
    expect(mocks.incidents.mock.calls[0][0].where).toMatchObject({ tenantId: "school-a", studentId: { in: ["p1"] }, occurredAt: { gte: expect.any(Date), lte: expect.any(Date) } });
    expect(mocks.results.mock.calls[0][0].where).toMatchObject({ tenantId: "school-a", studentId: { in: ["p1"] }, assessment: { tenantId: "school-a" } });
    expect(data.classes[0].attendance.value).toBeNull();
    expect(data.classes[0].recorded).toBe(0);
  });
  it("does not query pupil outcomes when no named classes are available", async () => {
    mocks.links.mockResolvedValue([]);
    expect((await loadClasses("empty-school", 7)).classes).toEqual([]);
    expect(mocks.incidents).not.toHaveBeenCalled();
    expect(mocks.results).not.toHaveBeenCalled();
  });
  it("retains distinct assessments at the same point instead of discarding one", async () => {
    const student = { id: "p1", fullName: "Pupil", yearGroup: "Y7", snapshots: [] };
    mocks.links.mockResolvedValue([{ className: "7A", subject: { id: "maths", name: "Maths" }, teacher: { id: "t1", fullName: "Teacher" }, student }]);
    const base = { studentId: "p1", rawValue: "50", normalizedScore: .5, isValid: true, status: "PRESENT", assessment: { id: "a1", subject: "Maths", title: "Paper 1", gradeFormat: "PERCENTAGE", maxScore: null, createdAt: new Date(), point: { id: "point", label: "Mock", ordinal: 1, assessedAt: new Date(), resultStatus: "PUBLISHED", cycle: { id: "cycle", label: "2026", academicYear: "2026" } } } };
    mocks.results.mockResolvedValue([base, { ...base, rawValue: "70", assessment: { ...base.assessment, id: "a2", title: "Paper 2" } }]);
    const group = (await loadClasses("school", 21)).classes[0];
    expect(group.points).toHaveLength(2);
    expect(group.students[0].grades.map(g => g.value).sort()).toEqual(["50", "70"]);
  });
});
