import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
import { attendanceRateBetween } from "../attendanceTrend";
const start = new Date("2026-10-01T00:00:00Z");
const end = new Date("2026-10-08T00:00:00Z");
const row = (snapshotDate: Date, attendancePossibleCount: number, attendancePresentCount: number) => ({ snapshotDate, attendancePossibleCount, attendancePresentCount });
describe("attendance comparisons", () => {
  it("weights sessions rather than averaging student percentages", () => {
    expect(attendanceRateBetween([
      { snapshots: [row(start, 10, 10), row(end, 20, 20)] },
      { snapshots: [row(start, 10, 10), row(end, 12, 10)] },
    ], start, end)).toBeCloseTo(1000 / 12);
  });
  it("excludes resets and missing baselines", () => {
    expect(attendanceRateBetween([
      { snapshots: [row(start, 20, 18), row(end, 10, 9)] },
      { snapshots: [row(end, 10, 9)] },
    ], start, end)).toBeNull();
  });
  it("rejects impossible attendance deltas", () => {
    expect(attendanceRateBetween([{ snapshots: [row(start, 10, 5), row(end, 12, 10)] }], start, end)).toBeNull();
  });
});
