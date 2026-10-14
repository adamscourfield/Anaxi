/**
 * Builds the leadership home page's "this week's briefing" narrative.
 *
 * This is a template-driven summary, not an AI-generated one: every sentence
 * is composed from thresholds against data already computed elsewhere
 * (attendance headline/trend, Teacher Risk Index, Student Risk Index, CPD
 * priorities). Kept as a pure function so it's independently testable and so
 * the wording stays auditable -- no model call, no hallucination risk.
 */

import { NATIONAL_ATTENDANCE_BENCHMARK_PCT, type AttendanceHeadline, type AttendanceTrend } from "./hydration";
import type { TeacherRiskRow } from "@/modules/analysis/teacherRisk";
import type { StudentRiskRow } from "@/modules/analysis/studentRisk";
import type { CpdPriorityRow } from "@/modules/analysis/cpdPriorities";

export type SummaryTone = "positive" | "watch" | "negative" | "neutral";

export type SummaryLine = {
  id: string;
  text: string;
  tone: SummaryTone;
};

export type LeaderSummary = {
  headline: string;
  headlineTone: SummaryTone;
  lines: SummaryLine[];
};

const FLAT_THRESHOLD_PTS = 0.5;

function deltaOf(current: number | null, prior: number | null): number | null {
  if (current === null || prior === null) return null;
  return Math.round((current - prior) * 10) / 10;
}

function formatPts(delta: number): string {
  const abs = Math.abs(delta).toFixed(1);
  if (delta > FLAT_THRESHOLD_PTS) return `up ${abs} pts`;
  if (delta < -FLAT_THRESHOLD_PTS) return `down ${abs} pts`;
  return "flat";
}

function toneForDelta(delta: number): SummaryTone {
  if (delta > FLAT_THRESHOLD_PTS) return "positive";
  if (delta < -FLAT_THRESHOLD_PTS) return "negative";
  return "neutral";
}

export function buildLeaderSummary({
  attendanceHeadline,
  attendanceTrend,
  studentRows,
  teacherRows,
  cpdRows,
  topImproving,
}: {
  attendanceHeadline: AttendanceHeadline;
  attendanceTrend: AttendanceTrend;
  studentRows: StudentRiskRow[];
  teacherRows: TeacherRiskRow[];
  cpdRows: CpdPriorityRow[];
  topImproving: CpdPriorityRow[];
}): LeaderSummary {
  const lines: SummaryLine[] = [];

  // ── Attendance ──────────────────────────────────────────────────────────
  if (attendanceHeadline.attendancePct !== null) {
    const vsNational = deltaOf(attendanceHeadline.attendancePct, NATIONAL_ATTENDANCE_BENCHMARK_PCT)!;
    lines.push({
      id: "attendance-national",
      text: `Attendance is ${formatPts(vsNational)} vs the national average (${NATIONAL_ATTENDANCE_BENCHMARK_PCT}%).`,
      tone: toneForDelta(vsNational),
    });
  }

  const weekDelta = deltaOf(attendanceTrend.last7DaysPct, attendanceTrend.prior7DaysPct);
  if (weekDelta !== null) {
    lines.push({
      id: "attendance-week",
      text: `Attendance is ${formatPts(weekDelta)} vs last week (now ${attendanceTrend.last7DaysPct}%).`,
      tone: toneForDelta(weekDelta),
    });
  }

  const monthDelta = deltaOf(attendanceTrend.last28DaysPct, attendanceTrend.prior28DaysPct);
  if (monthDelta !== null) {
    lines.push({
      id: "attendance-month",
      text: `Attendance is ${formatPts(monthDelta)} vs last month (now ${attendanceTrend.last28DaysPct}%).`,
      tone: toneForDelta(monthDelta),
    });
  }

  // ── Signals ──────────────────────────────────────────────────────────────
  const weakestSignal = cpdRows.find((r) => r.priorityScore > 0);
  if (weakestSignal) {
    lines.push({
      id: "signal-weak",
      text: `${weakestSignal.label} is the clearest weak signal: ${weakestSignal.teachersDriftingDown} of ${weakestSignal.teachersCovered} teachers show a decline.`,
      tone: "negative",
    });
  }

  const strongestSignal = topImproving[0];
  if (strongestSignal) {
    lines.push({
      id: "signal-strong",
      text: `${strongestSignal.label} is the strongest signal: ${strongestSignal.teachersImproving} of ${strongestSignal.teachersCovered} teachers are improving.`,
      tone: "positive",
    });
  }

  // ── Students ─────────────────────────────────────────────────────────────
  const studentsUrgent = studentRows.filter((s) => s.band === "URGENT");
  const studentsPriority = studentRows.filter((s) => s.band === "PRIORITY");
  const studentsNeedingFocus = studentsUrgent.length + studentsPriority.length;
  if (studentsNeedingFocus > 0) {
    lines.push({
      id: "students-focus",
      text: `${studentsNeedingFocus} student${studentsNeedingFocus === 1 ? "" : "s"} need${studentsNeedingFocus === 1 ? "s" : ""} focus this window${studentsUrgent.length ? ` (${studentsUrgent.length} urgent)` : ""}.`,
      tone: studentsUrgent.length > 0 ? "negative" : "watch",
    });
  } else if (studentRows.length > 0) {
    lines.push({ id: "students-focus", text: "No students are flagged as urgent or priority this window.", tone: "positive" });
  }

  // ── Staff ────────────────────────────────────────────────────────────────
  const staffDrifting = teacherRows.filter((t) => t.status === "SIGNIFICANT_DRIFT" || t.status === "EMERGING_DRIFT");
  if (staffDrifting.length > 0) {
    lines.push({
      id: "staff-focus",
      text: `${staffDrifting.length} teacher${staffDrifting.length === 1 ? "" : "s"} would benefit from support, based on lesson signals.`,
      tone: "negative",
    });
  }

  const staffCelebrate = teacherRows.filter(
    (t) => t.momentumStatus === "STRONG_IMPROVEMENT" || t.momentumStatus === "EMERGING_IMPROVEMENT"
  );
  if (staffCelebrate.length > 0) {
    lines.push({
      id: "staff-celebrate",
      text: `${staffCelebrate.length} teacher${staffCelebrate.length === 1 ? "" : "s"} worth celebrating this window — lesson signals are trending up.`,
      tone: "positive",
    });
  }

  const headline = buildHeadline(studentsNeedingFocus, staffDrifting.length, staffCelebrate.length);
  return { headline: headline.text, headlineTone: headline.tone, lines };
}

function buildHeadline(studentsNeedingFocus: number, staffDrifting: number, staffCelebrate: number): { text: string; tone: SummaryTone } {
  const concerns = studentsNeedingFocus + staffDrifting;

  if (concerns === 0 && staffCelebrate === 0) {
    return { text: "A quiet window — nothing urgent needs your attention.", tone: "positive" };
  }
  if (concerns === 0) {
    return {
      text: `A steady window, with ${staffCelebrate} teacher${staffCelebrate === 1 ? "" : "s"} worth celebrating.`,
      tone: "positive",
    };
  }

  const parts: string[] = [];
  if (studentsNeedingFocus > 0) parts.push(`${studentsNeedingFocus} student${studentsNeedingFocus === 1 ? "" : "s"}`);
  if (staffDrifting > 0) parts.push(`${staffDrifting} teacher${staffDrifting === 1 ? "" : "s"}`);
  return { text: `${parts.join(" and ")} need a closer look this window.`, tone: concerns > 3 ? "negative" : "watch" };
}
