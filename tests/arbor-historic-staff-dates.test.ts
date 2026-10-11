import { describe, expect, it } from "vitest";
import { historicTimetableStaff } from "@/lib/integrations/arbor/historicTimetableStaff";

describe("historical timetable staff allocations", () => {
  it("retains last year's shared Maths teachers and excludes their current replacement", () => {
    const records = [
      { effectiveDate: "2025-09-01", endDate: "2026-07-20", staff: { id: "previous-a", fullName: "Previous A" } },
      { effectiveDate: "2026-01-01", endDate: "2026-07-20", staff: { id: "previous-b", fullName: "Previous B" } },
      { effectiveDate: "2026-09-01", endDate: null, staff: { id: "current", fullName: "Current" } },
    ];
    expect(historicTimetableStaff(records, "2025-09-01", "2026-07-15").map((p) => p.id)).toEqual(["previous-a", "previous-b"]);
  });
  it("rejects older and undated allocations and deduplicates repeated lessons", () => {
    const staff = { id: "teacher", fullName: "Teacher" };
    const row = { effectiveDate: "2025-09-01", endDate: null, staff };
    expect(historicTimetableStaff([
      { ...row, effectiveDate: null }, { ...row, endDate: "2025-07-20" }, row, row,
    ], "2025-09-01", "2026-07-15")).toEqual([staff]);
  });
});
