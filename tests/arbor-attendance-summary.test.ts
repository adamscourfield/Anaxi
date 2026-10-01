import { expect, it } from "vitest";
import { summariseAttendance } from "@/lib/integrations/arbor/attendanceSummary";
it("aggregates only linked, possible attendance records", () => {
  const result = summariseAttendance([
    { student: { id: "s" }, attendanceMark: { isStatisticalPresent: true, isStatisticalPossibleAttendance: true, isDefaultLate: false }, minutesLate: 0, isRedundant: false },
    { student: { id: "s" }, attendanceMark: { isStatisticalPresent: false, isStatisticalPossibleAttendance: true, isDefaultLate: true }, minutesLate: 0, isRedundant: false },
  ], new Set(["s"]));
  expect(result.byStudent.get("s")).toEqual({ possible: 2, present: 1, late: 1 });
});
