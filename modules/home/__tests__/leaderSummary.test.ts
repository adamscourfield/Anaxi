import { describe, it, expect } from "vitest";
import { buildLeaderSummary } from "@/modules/home/leaderSummary";
import type { AttendanceHeadline, AttendanceTrend } from "@/modules/home/hydration";
import type { TeacherRiskRow } from "@/modules/analysis/teacherRisk";
import type { StudentRiskRow } from "@/modules/analysis/studentRisk";
import type { CpdPriorityRow } from "@/modules/analysis/cpdPriorities";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const emptyAttendanceHeadline: AttendanceHeadline = {
  attendancePct: null,
  yesterdayPct: null,
  yesterdayLatenessPct: null,
  studentsCovered: 0,
  asOf: null,
};

const emptyAttendanceTrend: AttendanceTrend = {
  last7DaysPct: null,
  prior7DaysPct: null,
  last28DaysPct: null,
  prior28DaysPct: null,
};

function makeTeacherRow(overrides: Partial<TeacherRiskRow>): TeacherRiskRow {
  return {
    teacherMembershipId: "t1",
    teacherName: "Jane Teacher",
    avatarUpdatedAt: null,
    teacherRole: "TEACHER",
    departmentNames: [],
    teacherCoverage: 10,
    lastObservationAt: null,
    normalizedIDS: 0,
    status: "STABLE",
    topDrivers: [],
    normalizedPositiveIDS: 0,
    momentumStatus: "NONE",
    topImprovingDrivers: [],
    ...overrides,
  };
}

function makeStudentRow(overrides: Partial<StudentRiskRow>): StudentRiskRow {
  return {
    studentId: "s1",
    studentName: "Sam Student",
    yearGroup: "Year 10",
    status: "ACTIVE",
    sendFlag: false,
    ppFlag: false,
    band: "STABLE",
    riskScore: 0,
    confidence: "HIGH",
    lastSnapshotDate: null,
    drivers: [],
    attendancePct: null,
    detentionsCount: null,
    onCallsCount: null,
    detentionsDelta: null,
    onCallsDelta: null,
    latenessDelta: null,
    suspensionsDelta: null,
    internalExclusionsDelta: null,
    attendanceDelta: null,
    positivePointsTotal: null,
    onWatchlist: false,
    ...overrides,
  };
}

function makeCpdRow(overrides: Partial<CpdPriorityRow>): CpdPriorityRow {
  return {
    signalKey: "SIGNAL_A",
    label: "Signal A",
    teachersCovered: 10,
    teachersDriftingDown: 0,
    driftRate: 0,
    avgNegativeDelta: null,
    avgNegDeltaAbs: null,
    priorityScore: 0,
    teachersImproving: 0,
    improvingRate: 0,
    avgPositiveDelta: null,
    priorityImprovementScore: 0,
    ...overrides,
  };
}

// ─── buildLeaderSummary ─────────────────────────────────────────────────────

describe("buildLeaderSummary", () => {
  it("returns a quiet headline when there is nothing to report", () => {
    const summary = buildLeaderSummary({
      attendanceHeadline: emptyAttendanceHeadline,
      attendanceTrend: emptyAttendanceTrend,
      studentRows: [],
      teacherRows: [],
      cpdRows: [],
      topImproving: [],
    });
    expect(summary.headline).toMatch(/quiet window/i);
    expect(summary.headlineTone).toBe("positive");
    expect(summary.lines).toHaveLength(0);
  });

  it("flags attendance below the national average as negative", () => {
    const summary = buildLeaderSummary({
      attendanceHeadline: { ...emptyAttendanceHeadline, attendancePct: 90 },
      attendanceTrend: emptyAttendanceTrend,
      studentRows: [],
      teacherRows: [],
      cpdRows: [],
      topImproving: [],
    });
    const line = summary.lines.find((l) => l.id === "attendance-national");
    expect(line?.tone).toBe("negative");
    expect(line?.text).toMatch(/down/i);
  });

  it("flags attendance above the national average as positive", () => {
    const summary = buildLeaderSummary({
      attendanceHeadline: { ...emptyAttendanceHeadline, attendancePct: 98 },
      attendanceTrend: emptyAttendanceTrend,
      studentRows: [],
      teacherRows: [],
      cpdRows: [],
      topImproving: [],
    });
    const line = summary.lines.find((l) => l.id === "attendance-national");
    expect(line?.tone).toBe("positive");
    expect(line?.text).toMatch(/up/i);
  });

  it("computes week-over-week and month-over-month attendance deltas", () => {
    const summary = buildLeaderSummary({
      attendanceHeadline: emptyAttendanceHeadline,
      attendanceTrend: { last7DaysPct: 92, prior7DaysPct: 95, last28DaysPct: 93, prior28DaysPct: 90 },
      studentRows: [],
      teacherRows: [],
      cpdRows: [],
      topImproving: [],
    });
    const week = summary.lines.find((l) => l.id === "attendance-week");
    const month = summary.lines.find((l) => l.id === "attendance-month");
    expect(week?.tone).toBe("negative");
    expect(week?.text).toMatch(/down 3\.0 pts/);
    expect(month?.tone).toBe("positive");
    expect(month?.text).toMatch(/up 3\.0 pts/);
  });

  it("counts urgent and priority students as needing focus", () => {
    const summary = buildLeaderSummary({
      attendanceHeadline: emptyAttendanceHeadline,
      attendanceTrend: emptyAttendanceTrend,
      studentRows: [
        makeStudentRow({ studentId: "s1", band: "URGENT" }),
        makeStudentRow({ studentId: "s2", band: "PRIORITY" }),
        makeStudentRow({ studentId: "s3", band: "STABLE" }),
      ],
      teacherRows: [],
      cpdRows: [],
      topImproving: [],
    });
    const line = summary.lines.find((l) => l.id === "students-focus");
    expect(line?.text).toMatch(/2 students need focus/);
    expect(line?.text).toMatch(/1 urgent/);
    expect(line?.tone).toBe("negative");
  });

  it("separates teachers needing support from teachers worth celebrating", () => {
    const summary = buildLeaderSummary({
      attendanceHeadline: emptyAttendanceHeadline,
      attendanceTrend: emptyAttendanceTrend,
      studentRows: [],
      teacherRows: [
        makeTeacherRow({ teacherMembershipId: "t1", status: "SIGNIFICANT_DRIFT" }),
        makeTeacherRow({ teacherMembershipId: "t2", momentumStatus: "STRONG_IMPROVEMENT" }),
        makeTeacherRow({ teacherMembershipId: "t3", status: "STABLE", momentumStatus: "NONE" }),
      ],
      cpdRows: [],
      topImproving: [],
    });
    const focus = summary.lines.find((l) => l.id === "staff-focus");
    const celebrate = summary.lines.find((l) => l.id === "staff-celebrate");
    expect(focus?.text).toMatch(/1 teacher/);
    expect(focus?.tone).toBe("negative");
    expect(celebrate?.text).toMatch(/1 teacher/);
    expect(celebrate?.tone).toBe("positive");
  });

  it("surfaces the weakest and strongest school-wide signals", () => {
    const summary = buildLeaderSummary({
      attendanceHeadline: emptyAttendanceHeadline,
      attendanceTrend: emptyAttendanceTrend,
      studentRows: [],
      teacherRows: [],
      cpdRows: [
        makeCpdRow({ signalKey: "WEAK", label: "Pace", priorityScore: 0.2, teachersDriftingDown: 3, teachersCovered: 10 }),
        makeCpdRow({ signalKey: "FINE", label: "Climate", priorityScore: 0 }),
      ],
      topImproving: [makeCpdRow({ signalKey: "STRONG", label: "Retrieval", teachersImproving: 4, teachersCovered: 10 })],
    });
    expect(summary.lines.find((l) => l.id === "signal-weak")?.text).toMatch(/Pace/);
    expect(summary.lines.find((l) => l.id === "signal-strong")?.text).toMatch(/Retrieval/);
  });

  it("builds a combined headline when both students and staff need attention", () => {
    const summary = buildLeaderSummary({
      attendanceHeadline: emptyAttendanceHeadline,
      attendanceTrend: emptyAttendanceTrend,
      studentRows: [makeStudentRow({ studentId: "s1", band: "URGENT" })],
      teacherRows: [makeTeacherRow({ teacherMembershipId: "t1", status: "EMERGING_DRIFT" })],
      cpdRows: [],
      topImproving: [],
    });
    expect(summary.headline).toMatch(/1 student and 1 teacher need a closer look/);
    expect(summary.headlineTone).toBe("watch");
  });
});
