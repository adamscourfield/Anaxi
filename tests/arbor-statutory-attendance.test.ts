import { describe, expect, it } from "vitest";
import { summariseStatutoryAttendance, type StatutoryAttendanceRecord } from "@/lib/integrations/arbor/statutoryAttendance";
const record = (slot: string, present: boolean, overrides: Partial<StatutoryAttendanceRecord> = {}): StatutoryAttendanceRecord => ({
  id: slot, recordDate: "2026-10-14", student: { id: "pupil" }, attendanceRollCall: { id: slot, code: slot }, minutesLate: 0,
  attendanceMark: { code: present ? "/" : "N", isStatisticalPresent: present, isStatisticalApprovedEducationalActivity: false, isStatisticalPossibleAttendance: true, isDefaultLate: false }, ...overrides,
});
describe("statutory roll-call attendance", () => {
  it("counts one AM and one PM session, with an absent PM making 50%", () => {
    expect(summariseStatutoryAttendance([record("AM", true), record("PM", false)], new Set(["pupil"])).byStudent.get("pupil")).toEqual({ possible: 2, present: 1, late: 0 });
  });
  it("selects statutory AM explicitly for morning attendance, not the earliest lesson", () => {
    expect(summariseStatutoryAttendance([record("PM", false), record("AM", true)], new Set(["pupil"]), true).byStudent.get("pupil")?.possible).toBe(1);
    expect(summariseStatutoryAttendance([record("PM", false), record("AM", true)], new Set(["pupil"]), true).byStudent.get("pupil")?.present).toBe(1);
  });
  it("counts approved educational activities as attended and excludes non-possible marks", () => {
    const approved = record("AM", false);
    approved.attendanceMark!.isStatisticalApprovedEducationalActivity = true;
    const excluded = record("PM", false);
    excluded.attendanceMark!.isStatisticalPossibleAttendance = false;
    expect(summariseStatutoryAttendance([approved, excluded], new Set(["pupil"])).byStudent.get("pupil")).toEqual({ possible: 1, present: 1, late: 0 });
  });
  it("deduplicates repeated IDs and rejects conflicting AM/PM records", () => {
    const am = record("AM", true);
    expect(summariseStatutoryAttendance([am, am], new Set(["pupil"])).byStudent.get("pupil")?.possible).toBe(1);
    expect(() => summariseStatutoryAttendance([am, record("AM", false, { id: "other" })], new Set(["pupil"]))).toThrow("duplicate statutory");
  });
  it("never falls back to lesson marks, unknown sessions or incomplete marks", () => {
    expect(() => summariseStatutoryAttendance([record("LESSON", true)], new Set(["pupil"]))).toThrow("unrecognised");
    expect(() => summariseStatutoryAttendance([record("AM", true, { attendanceMark: null })], new Set(["pupil"]))).toThrow("incomplete");
  });
});
