import { describe, expect, it } from "vitest";
import { academicYearStart, addDays, attendancePercentage, dateKey } from "@/lib/integrations/arbor/attendanceSync";

describe("Arbor attendance sync helpers", () => {
  it("uses 1 September as the academic-year boundary", () => {
    expect(dateKey(academicYearStart(new Date("2026-08-31T12:00:00Z")))).toBe("2025-09-01");
    expect(dateKey(academicYearStart(new Date("2026-09-01T12:00:00Z")))).toBe("2026-09-01");
  });

  it("keeps precise cumulative attendance and normalises snapshot dates", () => {
    expect(attendancePercentage({ possible: 37, present: 35, late: 2 })).toBe(94.6);
    expect(dateKey(addDays(new Date("2026-09-01T00:00:00Z"), 7))).toBe("2026-09-08");
  });
});
