import { beforeEach, describe, expect, it, vi } from "vitest";
const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { assessment: { findMany } } }));
vi.mock("@/lib/auth", () => ({ getSessionUserOrThrow: async () => ({ tenantId: "school" }) }));
vi.mock("@/lib/guards", () => ({ requireFeature: async () => {} }));
import { GET } from "@/app/api/assessments/metrics/route";

function result(id: string, grade: number, ppFlag: boolean | null, sendFlag: boolean | null) {
  return { studentId: id, rawValue: String(grade), normalizedScore: grade / 9, status: "PRESENT", isValid: true, ppFlag, sendFlag,
    student: { fullName: id, yearGroup: "11", ppFlag: false, sendFlag: true } };
}
async function metrics(results: ReturnType<typeof result>[]) {
  findMany.mockResolvedValue([{ id: "maths", subject: "Maths", gradeFormat: "GCSE", results }]);
  const response = await GET(new Request("https://anaxi.io/api/assessments/metrics?pointId=mock1"), { params: Promise.resolve({}) });
  return response.json();
}
describe("assessment cohort metrics", () => {
  beforeEach(() => vi.clearAllMocks());
  it("uses assessment flags including explicit No instead of profile flags", async () => {
    const data = await metrics([result("a", 5, true, false), result("b", 3, false, true)]);
    expect(data.subjects[0].pp).toMatchObject({ count: 1, t4: 100, nonPpT4: 0, gap4: -100 });
    expect(data.subjects[0].send).toMatchObject({ count: 1, t4: 0, nonSendT4: 100, gap4: 100 });
  });
  it("returns unavailable rates and gaps for empty cohorts", async () => {
    const data = await metrics([result("a", 5, false, false)]);
    expect(data.subjects[0].pp).toMatchObject({ count: 0, t4: null, t5: null, gap4: null, gap5: null });
  });
  it("does not round a split science grade up across a pass threshold", async () => {
    const split = { ...result("a", 3.5, true, false), rawValue: "4-3" };
    const data = await metrics([split]);
    expect(data.subjects[0].thresholds["4+"]).toBe(0);
    expect(data.subjects[0].distribution).toEqual([{ grade: "4-3", count: 1 }]);
  });
  it("uses profile membership when an assessment has no recorded flags", async () => {
    const data = await metrics([result("a", 3, null, null)]);
    expect(data.subjects[0].send).toMatchObject({ count: 1, t4: 0, gap4: null });
  });
});
