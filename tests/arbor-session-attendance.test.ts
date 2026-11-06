import { describe, expect, it } from "vitest";
import { summariseSessionAttendance } from "@/lib/integrations/arbor/sessionAttendance";
import type { ArborAttendanceRecord } from "@/lib/integrations/arbor/attendanceSummary";
const mark = (time: string, present: boolean, extra: Partial<ArborAttendanceRecord> = {}): ArborAttendanceRecord => ({ student: { id: "p" }, startDatetime: time, attendanceMark: { code: present ? "/" : "O", isStatisticalPresent: present, isStatisticalPossibleAttendance: true, isDefaultLate: false }, isRedundant: false, minutesLate: null, ...extra });
const day = "2026-11-05";
const rollup = (records: ArborAttendanceRecord[]) => summariseSessionAttendance(records, new Set(["p"]), day);
describe("recorded AM/PM attendance", () => {
  it("counts a pupil at most twice regardless of lessons or duplicate marks", () => {
    const records = ["09:00", "10:00", "11:00", "12:00", "14:00", "15:00"].map(time => mark(`${day}T${time}:00Z`, true));
    expect(rollup([...records, ...records]).byStudent.get("p")).toEqual({ possible: 2, present: 2, late: 0, unknown: 0 });
  });
  it("uses present evidence anywhere within a half day", () => {
    const result = rollup([mark(`${day}T09:00:00Z`, false), mark(`${day}T11:00:00Z`, true), mark(`${day}T13:00:00Z`, false)]);
    expect(result.byStudent.get("p")).toMatchObject({ possible: 2, present: 1 });
    expect(result.morningByStudent.get("p")?.present).toBe(1);
  });
  it("splits at London noon rather than UTC noon in British Summer Time", () => {
    const result = summariseSessionAttendance([mark("2026-09-03T10:59:00Z", true), mark("2026-09-03T11:00:00Z", false)], new Set(["p"]), "2026-09-03");
    expect(result.byStudent.get("p")).toMatchObject({ possible: 2, present: 1 });
    expect(result.morningByStudent.get("p")).toMatchObject({ possible: 1, present: 1 });
  });
  it("keeps missing and incomplete session marks unknown instead of absent", () => {
    const missing = mark(`${day}T10:00:00Z`, false, { attendanceMark: null });
    expect(rollup([mark(`${day}T09:00:00Z`, false), missing]).byStudent.get("p")).toMatchObject({ possible: 0, present: 0, unknown: 1 });
    const result = summariseSessionAttendance([mark(`${day}T09:00:00Z`, true)], new Set(["p", "missing"]), day);
    expect(result.byStudent.get("missing")).toMatchObject({ possible: 0, unknown: 1 });
    expect(result.byStudent.get("p")?.unknown).toBe(0); // no recorded afternoon at this school
  });
  it("excludes exempt sessions, redundant marks, other pupils and other dates", () => {
    const exempt = mark(`${day}T09:00:00Z`, false); exempt.attendanceMark!.isStatisticalPossibleAttendance = false;
    expect(rollup([exempt, mark(`${day}T10:00:00Z`, true, { isRedundant: true }), mark(`${day}T13:00:00Z`, true, { student: { id: "other" } }), mark("2026-11-04T13:00:00Z", true)]).byStudent.get("p")).toEqual({ possible: 0, present: 0, late: 0, unknown: 0 });
  });
  it("counts approved activity and lateness once per session", () => {
    const activity = mark(`${day}T13:00:00Z`, false); activity.attendanceMark!.isStatisticalApprovedEducationalActivity = true;
    expect(rollup([mark(`${day}T09:00:00Z`, true, { minutesLate: 5 }), mark(`${day}T10:00:00Z`, true, { minutesLate: 10 }), activity]).byStudent.get("p")).toMatchObject({ possible: 2, present: 2, late: 1 });
  });
  it("leaves a day with no registers outside the denominator", () => {
    expect(rollup([]).byStudent.get("p")).toEqual({ possible: 0, present: 0, late: 0, unknown: 0 });
  });
});
