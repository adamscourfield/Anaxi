import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
import { attendanceTotalsBetween, schoolAttendanceSummary } from "../schoolAttendance";
const date = (value: string) => new Date(`${value}T00:00:00Z`);
const row = (day: Date, possible: number | null, present: number | null) => ({ checkDate: day, fullDayPossibleCount: possible, fullDayPresentCount: present, fullDayStudentsCovered: 5 });
describe("cumulative attendance within each reporting period", () => {
  it("sums attended and possible sessions separately for year, 28, 21 and 7 days", () => {
    const rows = Array.from({ length: 44 }, (_, i) => row(new Date(date("2026-09-01").getTime() + i * 86400000), 10, i < 16 ? 10 : i < 37 ? 9 : 8));
    const result = schoolAttendanceSummary(rows, date("2026-10-15"));
    expect(result.headline?.attendancePct).toBeCloseTo(405 / 440 * 100);
    expect(result.headline?.asOf).toEqual(date("2026-10-14"));
    expect(result.trend.monthPct).toBeCloseTo(245 / 280 * 100);
    expect(result.trend.threeWeekPct).toBeCloseTo(182 / 210 * 100);
    expect(result.trend.weekPct).toBe(80);
  });
  it("weights sessions instead of averaging daily percentages", () => {
    expect(attendanceTotalsBetween([row(date("2026-10-01"), 100, 90), row(date("2026-10-02"), 2, 0)], date("2026-10-01"), date("2026-10-02"))?.pct).toBeCloseTo(90 / 102 * 100);
  });
  it("accepts imported weekends with no possible sessions but rejects missing or legacy days", () => {
    const rows = [row(date("2026-10-01"), 10, 9), row(date("2026-10-02"), 0, 0)];
    expect(attendanceTotalsBetween(rows, date("2026-10-01"), date("2026-10-02"))?.pct).toBe(90);
    expect(attendanceTotalsBetween(rows, date("2026-10-01"), date("2026-10-03"))).toBeNull();
    expect(attendanceTotalsBetween([row(date("2026-10-01"), null, null)], date("2026-10-01"), date("2026-10-01"))).toBeNull();
  });
  it("does not use missing days or impossible totals to manufacture a rate", () => {
    expect(attendanceTotalsBetween([row(date("2026-10-01"), 10, 11)], date("2026-10-01"), date("2026-10-01"))).toBeNull();
  });
});
