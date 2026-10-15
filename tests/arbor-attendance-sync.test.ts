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

import { attendanceBatchStart, ATTENDANCE_SYNC_VERSION } from "@/lib/integrations/arbor/attendanceProgress";
describe("attendance batch progress", () => {
  const end = new Date("2026-10-14T00:00:00Z");
  it("replays legacy imports independently of behaviour snapshot coverage", () => {
    expect(dateKey(attendanceBatchStart({}, end))).toBe("2026-09-01");
    expect(dateKey(attendanceBatchStart({ attendanceLastSyncedDate: "2026-09-21" }, end))).toBe("2026-09-01");
  });
  it("advances from a completed attendance batch and stops when caught up", () => {
    const config = { attendanceSyncVersion: ATTENDANCE_SYNC_VERSION, attendanceLastSyncedDate: "2026-09-21" };
    expect(dateKey(attendanceBatchStart(config, end))).toBe("2026-09-22");
    expect(attendanceBatchStart({ ...config, attendanceLastSyncedDate: "2026-10-14" }, end).getTime()).toBeGreaterThan(end.getTime());
  });
  it("restarts at the academic-year boundary for old or invalid checkpoints", () => {
    for (const attendanceLastSyncedDate of ["2025-10-14", "invalid", "2027-01-01"]) {
      expect(dateKey(attendanceBatchStart({ attendanceSyncVersion: ATTENDANCE_SYNC_VERSION, attendanceLastSyncedDate }, end))).toBe("2026-09-01");
    }
  });
});
