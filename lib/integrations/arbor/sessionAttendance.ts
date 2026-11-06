import type { ArborAttendanceRecord } from "./attendanceSummary";

type SessionTotals = { possible: number; present: number; late: number; unknown: number };
type Evidence = { present: boolean; eligible: boolean; unknown: boolean; late: boolean };
const london = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** Two recorded half-day sessions, inferred from permitted lesson marks.
 * The school's agreed boundary is noon in London, including British Summer Time.
 * These totals are not a reconstruction of the statutory registration codes.
 */
export function summariseSessionAttendance(records: ArborAttendanceRecord[], linked: Set<string>, day: string) {
  const evidence = new Map<string, Map<"AM" | "PM", Evidence>>();
  const open = new Set<"AM" | "PM">();
  for (const record of records) {
    if (record.isRedundant || !linked.has(record.student.id) || !record.startDatetime) continue;
    const timestamp = new Date(record.startDatetime);
    if (!Number.isFinite(timestamp.getTime())) continue;
    const parts = london.formatToParts(timestamp);
    const part = (name: string) => parts.find(p => p.type === name)?.value;
    if (`${part("year")}-${part("month")}-${part("day")}` !== day) continue;
    const session = Number(part("hour")) < 12 ? "AM" : "PM";
    open.add(session);
    const pupil = evidence.get(record.student.id) ?? new Map<"AM" | "PM", Evidence>();
    const value = pupil.get(session) ?? { present: false, eligible: false, unknown: false, late: false };
    const mark = record.attendanceMark;
    if (!mark || ["", "-", "?"].includes(mark.code?.trim() ?? "known")) value.unknown = true;
    else if (mark.isStatisticalPossibleAttendance) {
      value.eligible = true;
      value.present ||= mark.isStatisticalPresent || !!mark.isStatisticalApprovedEducationalActivity;
      value.late ||= mark.isDefaultLate || (record.minutesLate ?? 0) > 0;
    }
    pupil.set(session, value);
    evidence.set(record.student.id, pupil);
  }
  const byStudent = new Map<string, SessionTotals>();
  const morningByStudent = new Map<string, SessionTotals>();
  for (const id of linked) {
    const total: SessionTotals = { possible: 0, present: 0, late: 0, unknown: 0 };
    for (const session of ["AM", "PM"] as const) {
      const value = evidence.get(id)?.get(session);
      const result: SessionTotals = { possible: 0, present: 0, late: 0, unknown: 0 };
      if (value?.present) Object.assign(result, { possible: 1, present: 1, late: value.late ? 1 : 0 });
      else if (open.has(session) && (!value || value.unknown)) result.unknown = 1;
      else if (value?.eligible) Object.assign(result, { possible: 1, late: value.late ? 1 : 0 });
      for (const key of ["possible", "present", "late", "unknown"] as const) total[key] += result[key];
      if (session === "AM") morningByStudent.set(id, result);
    }
    byStudent.set(id, total);
  }
  return { byStudent, morningByStudent };
}
