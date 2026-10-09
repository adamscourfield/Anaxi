import { prisma } from "@/lib/prisma";
import { SessionUser } from "@/lib/types";
import { meetsGcseThreshold } from "@/modules/assessments/gradeNormalizer";
import {
  CpdPriorityRow,
  computeCpdPriorities,
  getTopImprovingSignals,
} from "@/modules/analysis/cpdPriorities";
import {
  computeTeacherRiskIndex,
  computeTeacherSignalProfile,
  TeacherRiskRow,
} from "@/modules/analysis/teacherRisk";
import { computeCohortPivot, CohortPivotRow } from "@/modules/analysis/cohortPivot";
import { getProgress8DashboardSummary, type Progress8DashboardSummary } from "@/modules/assessments/progress8";
import { computeStudentRiskIndex, StudentRiskRow } from "@/modules/analysis/studentRisk";
import { HomeAssembly } from "@/modules/home/assembler";
import { addDays, attendancePercentage, dateKey } from "@/lib/integrations/arbor/attendanceSync";

/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma dynamic model access */

async function safe<T>(task: Promise<T>, fallback: T): Promise<T> {
  try {
    return await task;
  } catch {
    return fallback;
  }
}

export type DualFlaggedStudent = {
  studentId: string;
  studentName: string;
  yearGroup: string | null;
  ppFlag: boolean;
  sendFlag: boolean;
  behaviouralBand: string;
  worstSubject: string;
  worstGrade: string;
  worstNormalizedScore: number | null;
};

export type AttainmentSummary = {
  cycleLabel: string;
  cycleId: string;
  latestPointLabel: string | null;
  subjectCount: number;
  studentCount: number;
  totalResults: number;
  progress8: Progress8DashboardSummary | null;
  triangulatedCount: number;
  urgentCount: number;
  priorityCount: number;
  topDualFlagged: DualFlaggedStudent[];
};

export type AttendanceHeadline = {
  /** Academic-year-to-date attendance. */
  attendancePct: number | null;
  /** Yesterday's completed morning-registration attendance. */
  yesterdayPct: number | null;
  /** Yesterday's late pupils as a share of morning registrations. */
  yesterdayLatenessPct: number | null;
  studentsCovered: number;
  asOf: Date | null;
};

type AttendanceSnapshot = {
  attendancePossibleCount: number;
  attendancePresentCount: number;
  latenessCount: number;
  snapshotDate: Date;
};

export function londonToday(): Date {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(new Date());
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return new Date(Date.UTC(value("year"), value("month") - 1, value("day")));
}

export function mondayOnOrBefore(date: Date): Date {
  const weekday = date.getUTCDay(); // 0 = Sunday .. 6 = Saturday
  const daysSinceMonday = weekday === 0 ? 6 : weekday - 1;
  return addDays(date, -daysSinceMonday);
}

/**
 * The leadership attendance card shows the academic-year headline, then two
 * completed-day operational figures from yesterday's morning registration.
 *
 * Arbor snapshots only store one row per student per day with YEAR_TO_DATE
 * cumulative totals, written by an overnight sync. DailyAttendanceCheck is
 * captured live at morning registration and lets us display yesterday's
 * attendance and lateness without mixing AM and PM register records.
 */
async function fetchAttendanceHeadline(tenantId: string): Promise<AttendanceHeadline> {
  const today = londonToday();
  const yesterday = addDays(today, -1);
  const yesterdayKey = dateKey(yesterday);

  const students = await (prisma as any).student.findMany({
      where: { tenantId, status: "ACTIVE" },
      select: {
        snapshots: {
          // Attendance and behaviour can arrive in separate same-day sync batches.
          // Only an attendance-bearing snapshot may supply the attendance headline.
          where: { countScope: "YEAR_TO_DATE", attendancePossibleCount: { gt: 0 } },
          orderBy: { snapshotDate: "desc" },
          // Three school-day rows cover the current headline plus yesterday and
          // the previous completed day, without loading an academic year's
          // history for every pupil on every home-page request.
          take: 3,
          select: { attendancePossibleCount: true, attendancePresentCount: true, latenessCount: true, snapshotDate: true },
        },
      },
    });
  // This supplementary table was introduced after snapshots already existed.
  // Its absence or a deployment race must never hide the snapshot fallback.
  const yesterdayCheck = await safe(
    (prisma as any).dailyAttendanceCheck.findUnique({
      where: { tenantId_checkDate: { tenantId, checkDate: yesterday } },
      select: { possibleCount: true, presentCount: true, lateCount: true },
    }),
    null as { possibleCount: number; presentCount: number; lateCount: number | null } | null,
  );

  let yearPossible = 0, yearPresent = 0, studentsCovered = 0;
  let fallbackYesterdayPossible = 0, fallbackYesterdayPresent = 0, fallbackYesterdayLate = 0;
  let asOf: Date | null = null;

  for (const student of students as Array<{ snapshots: AttendanceSnapshot[] }>) {
    const rows = student.snapshots;
    const latest = rows[0];
    if (!latest) continue;
    studentsCovered += 1;
    yearPossible += latest.attendancePossibleCount;
    yearPresent += latest.attendancePresentCount;
    if (!asOf || latest.snapshotDate > asOf) asOf = latest.snapshotDate;

    const yesterdayRow = rows.find((row) => dateKey(row.snapshotDate) === yesterdayKey);
    const previousRow = yesterdayRow
      ? rows.find((row) => dateKey(row.snapshotDate) < yesterdayKey)
      : undefined;
    if (yesterdayRow && previousRow) {
      fallbackYesterdayPossible += Math.max(0, yesterdayRow.attendancePossibleCount - previousRow.attendancePossibleCount);
      fallbackYesterdayPresent += Math.max(0, yesterdayRow.attendancePresentCount - previousRow.attendancePresentCount);
      fallbackYesterdayLate += Math.max(0, yesterdayRow.latenessCount - previousRow.latenessCount);
    }

  }

  const fallbackYesterdayAvailable = fallbackYesterdayPossible > 0;
  const yesterdayPossible = yesterdayCheck?.possibleCount ?? (fallbackYesterdayAvailable ? fallbackYesterdayPossible : 0);
  const yesterdayPresent = yesterdayCheck?.presentCount ?? (fallbackYesterdayAvailable ? fallbackYesterdayPresent : 0);
  const yesterdayLate = yesterdayCheck?.lateCount ?? (fallbackYesterdayAvailable ? fallbackYesterdayLate : null);

  return {
    attendancePct: studentsCovered > 0 ? attendancePercentage({ possible: yearPossible, present: yearPresent, late: 0 }) : null,
    yesterdayPct: yesterdayPossible > 0 ? attendancePercentage({ possible: yesterdayPossible, present: yesterdayPresent, late: 0 }) : null,
    yesterdayLatenessPct: yesterdayPossible > 0 && yesterdayLate !== null
      ? Math.round((yesterdayLate / yesterdayPossible) * 1000) / 10
      : null,
    studentsCovered,
    asOf,
  };
}

export type PendingLeaveDetail = {
  id: string;
  requesterUserId: string | null;
  requesterName: string;
  reasonLabel: string | null;
  startDate: string;
  endDate: string;
  notes: string | null;
  status: string;
  createdAt: string;
};

export type OnCallDetail = {
  id: string;
  requesterName: string;
  location: string;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
};

export async function hydrateLeadershipHomeData({
  user,
  windowDays,
  hasLeaveFeature,
  hasOnCallFeature,
  hasAssessmentsFeature,
  hasStudentAnalysisFeature,
}: {
  user: SessionUser;
  windowDays: number;
  hasLeaveFeature: boolean;
  hasOnCallFeature: boolean;
  hasAssessmentsFeature?: boolean;
  hasStudentAnalysisFeature?: boolean;
}) {
  const pendingLeavePromise = hasLeaveFeature
    ? safe(
        (async () => {
          const { loaManageableRequesterIds, canManageLoa } = await import("@/lib/loa");
          const { loaPendingApprovalWhere } = await import("@/modules/leave/leaveQuery");
          if (!(await canManageLoa(user))) return 0;
          const manageableIds = await loaManageableRequesterIds(user);
          return (prisma as any).lOARequest.count({
            where: loaPendingApprovalWhere(user.tenantId, user.id, manageableIds),
          });
        })(),
        0 as number
      )
    : Promise.resolve(0);

  /** OPEN + ACKNOWLEDGED queue counts + latest row for dashboard banner (not limited to recent history window). */
  const liveOnCallBannerPromise = hasOnCallFeature
    ? safe(
        Promise.all([
          (prisma as any).onCallRequest.count({
            where: { tenantId: user.tenantId, status: { in: ["OPEN", "ACKNOWLEDGED"] } },
          }),
          (prisma as any).onCallRequest.findFirst({
            where: { tenantId: user.tenantId, status: { in: ["OPEN", "ACKNOWLEDGED"] } },
            orderBy: { createdAt: "desc" },
            include: { requester: { select: { fullName: true } } },
          }),
        ]).then(([count, r]: [number, any]) => ({
          count: count as number,
          latest: r
            ? ({
                id: r.id as string,
                requesterName: (r.requester?.fullName ?? "Unknown") as string,
                location: (r.location ?? "") as string,
                status: r.status as string,
                createdAt: (r.createdAt as Date).toISOString(),
                resolvedAt: r.resolvedAt ? (r.resolvedAt as Date).toISOString() : null,
              } satisfies OnCallDetail)
            : null,
        })),
        { count: 0, latest: null as OnCallDetail | null }
      )
    : Promise.resolve({ count: 0, latest: null as OnCallDetail | null });

  const pendingLeaveDetailsPromise: Promise<PendingLeaveDetail[]> = hasLeaveFeature
    ? safe(
        (async () => {
          const { loaManageableRequesterIds, canManageLoa } = await import("@/lib/loa");
          const { loaPendingApprovalWhere } = await import("@/modules/leave/leaveQuery");
          if (!(await canManageLoa(user))) return [];
          const manageableIds = await loaManageableRequesterIds(user);
          const rows = await (prisma as any).lOARequest.findMany({
            where: loaPendingApprovalWhere(user.tenantId, user.id, manageableIds),
            include: { requester: { select: { id: true, fullName: true } }, reason: { select: { label: true } } },
            orderBy: { createdAt: "desc" },
            take: 3,
          });
          return rows.map((r: any) => ({
            id: r.id as string,
            requesterUserId: (r.requester?.id ?? null) as string | null,
            requesterName: (r.requester?.fullName ?? "Unknown") as string,
            reasonLabel: (r.reason?.label ?? null) as string | null,
            startDate: (r.startDate as Date).toISOString(),
            endDate: (r.endDate as Date).toISOString(),
            notes: r.notes as string | null,
            status: r.status as string,
            createdAt: (r.createdAt as Date).toISOString(),
          }));
        })(),
        [] as PendingLeaveDetail[]
      )
    : Promise.resolve([] as PendingLeaveDetail[]);

  const onCallDetailsPromise: Promise<OnCallDetail[]> = hasOnCallFeature
    ? safe(
        (prisma as any).onCallRequest
          .findMany({
            where: { tenantId: user.tenantId },
            include: { requester: { select: { fullName: true } } },
            orderBy: { createdAt: "desc" },
            take: 5,
          })
          .then((rows: any[]) =>
            rows.map((r: any) => ({
              id: r.id as string,
              requesterName: (r.requester?.fullName ?? "Unknown") as string,
              location: (r.location ?? "") as string,
              status: r.status as string,
              createdAt: (r.createdAt as Date).toISOString(),
              resolvedAt: r.resolvedAt ? (r.resolvedAt as Date).toISOString() : null,
            }))
          ),
        [] as OnCallDetail[]
      )
    : Promise.resolve([] as OnCallDetail[]);

  const onCallStatsPromise = hasOnCallFeature
    ? safe(
        Promise.all([
          (prisma as any).onCallRequest.count({
            where: { tenantId: user.tenantId, status: "RESOLVED" },
          }),
          (prisma as any).onCallRequest.count({
            where: { tenantId: user.tenantId, status: "ACKNOWLEDGED" },
          }),
          (prisma as any).onCallRequest.count({
            where: { tenantId: user.tenantId, status: "OPEN" },
          }),
        ]).then(([resolved, active, escalation]) => ({ resolved, active, escalation })),
        { resolved: 0, active: 0, escalation: 0 }
      )
    : Promise.resolve({ resolved: 0, active: 0, escalation: 0 });

  const attainmentPromise: Promise<AttainmentSummary | null> = hasAssessmentsFeature
    ? safe(
        (prisma as any).assessmentCycle
          .findFirst({
            where: { tenantId: user.tenantId, isActive: true },
            include: {
              points: {
                orderBy: { ordinal: "desc" },
                include: {
                  assessments: {
                    include: { _count: { select: { results: true } } },
                  },
                },
              },
            },
          })
          .then(async (cycle: any) => {
            if (!cycle) return null;
            const points = cycle.points as any[];
            const allAssessments = points.flatMap((p: any) => p.assessments as any[]);
            const totalResults = allAssessments.reduce(
              (sum: number, a: any) => sum + (a._count?.results ?? 0),
              0
            );

            // Distinct subject count across the whole cycle
            const subjectNames = new Set<string>(allAssessments.map((a: any) => a.subject as string));
            const subjectCount = subjectNames.size;

            // Student count: distinct students in the most recent point that has data
            const latestPointWithData = points.find((p: any) => (p.assessments as any[]).length > 0);
            const latestPointLabel = (latestPointWithData?.label ?? null) as string | null;

            const latestAssessmentIds = latestPointWithData
              ? (latestPointWithData.assessments as any[]).map((a: any) => a.id as string)
              : [];
            const studentCount = latestAssessmentIds.length > 0
              ? await prisma.assessmentResult.groupBy({
                  by: ["studentId"],
                  where: {
                    tenantId: user.tenantId,
                    status: "PRESENT",
                    assessmentId: { in: latestAssessmentIds },
                  },
                }).then((rows: any[]) => rows.length)
              : 0;

            // Triangulation: students flagged with both high SRI and low attainment
            const { computeTriangulatedRisks } = await import("@/modules/assessments/analysis");
            const tri = await computeTriangulatedRisks(user.tenantId, user.id, windowDays);

            const topDualFlagged: DualFlaggedStudent[] = tri.students.slice(0, 5).map((s) => {
              const worst = s.attainmentResults[0]; // already sorted ascending by score
              return {
                studentId: s.studentId,
                studentName: s.studentName,
                yearGroup: s.yearGroup,
                ppFlag: s.ppFlag,
                sendFlag: s.sendFlag,
                behaviouralBand: s.behaviouralBand,
                worstSubject: worst?.subject ?? "",
                worstGrade: worst?.rawValue ?? "",
                worstNormalizedScore: worst?.normalizedScore ?? null,
              };
            });

            return {
              cycleLabel: cycle.label as string,
              cycleId: cycle.id as string,
              latestPointLabel,
              subjectCount,
              studentCount,
              totalResults,
              progress8: await getProgress8DashboardSummary(user.tenantId),
              triangulatedCount: tri.meta.total,
              urgentCount: tri.meta.urgent,
              priorityCount: tri.meta.priority,
              topDualFlagged,
            };
          }),
        null as AttainmentSummary | null
      )
    : Promise.resolve(null as AttainmentSummary | null);

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  // Use Europe/London's actual day boundary, not the server's local time (production
  // runs in UTC) -- during British Summer Time a plain server-local midnight cutoff
  // is an hour off from the school's real day boundary, clipping or including
  // meetings from the wrong day.
  const londonOffsetMinutes = (date: Date): number => {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(date);
    const value = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    const asIfUTC = Date.UTC(value("year"), value("month") - 1, value("day"), value("hour") % 24, value("minute"), value("second"));
    return Math.round((asIfUTC - date.getTime()) / 60000);
  };
  const now = new Date();
  const offsetMinutes = londonOffsetMinutes(now);
  const londonNow = new Date(now.getTime() + offsetMinutes * 60000);
  const startOfToday = new Date(
    Date.UTC(londonNow.getUTCFullYear(), londonNow.getUTCMonth(), londonNow.getUTCDate()) - offsetMinutes * 60000,
  );
  const endOfToday = addDays(startOfToday, 1);

  const meetingsTodayPromise = safe(
    (prisma as any).meeting.count({
      where: {
        tenantId: user.tenantId,
        startDateTime: { gte: startOfToday, lt: endOfToday },
      },
    }),
    0 as number
  );

  const weekObsPromise = safe(
    Promise.all([
      (prisma as any).observation.count({
        where: { tenantId: user.tenantId, observedAt: { gte: weekAgo } },
      }),
      (prisma as any).observation.findMany({
        where: { tenantId: user.tenantId, observedAt: { gte: weekAgo } },
        include: { observedTeacher: { select: { fullName: true, avatarUpdatedAt: true } } },
        orderBy: { observedAt: "desc" },
        take: 20,
      }),
    ]).then(([count, rows]: [number, any[]]) => {
      const seen = new Set<string>();
      const recentTeachers: { id: string; name: string; avatarUpdatedAt: Date | null }[] = [];
      for (const r of rows) {
        const tid = r.observedTeacherId as string;
        if (!seen.has(tid)) {
          seen.add(tid);
          recentTeachers.push({
            id: tid,
            name: (r.observedTeacher?.fullName ?? "Unknown") as string,
            avatarUpdatedAt: (r.observedTeacher?.avatarUpdatedAt ?? null) as Date | null,
          });
        }
        if (recentTeachers.length >= 5) break;
      }
      return { count, recentTeachers };
    }),
    { count: 0, recentTeachers: [] as { id: string; name: string; avatarUpdatedAt: Date | null }[] }
  );

  const [cpdRows, teacherRows, cohortResult, studentResult, pendingLeaveCount, liveOnCallBanner, pendingLeaveDetails, onCallDetails, onCallStats, weekObs, attainmentSummary, meetingsTodayCount, attainmentHeadline, attendanceHeadline] = await Promise.all([
    safe(computeCpdPriorities(user.tenantId, windowDays), [] as CpdPriorityRow[]),
    safe(computeTeacherRiskIndex(user.tenantId, windowDays), [] as TeacherRiskRow[]),
    safe(computeCohortPivot(user.tenantId, windowDays), { rows: [] as CohortPivotRow[], computedAt: new Date() }),
    hasStudentAnalysisFeature
      ? safe(computeStudentRiskIndex(user.tenantId, windowDays, user.id), { rows: [] as StudentRiskRow[], computedAt: new Date() })
      : Promise.resolve({ rows: [] as StudentRiskRow[], computedAt: new Date() }),
    pendingLeavePromise,
    liveOnCallBannerPromise,
    pendingLeaveDetailsPromise,
    onCallDetailsPromise,
    onCallStatsPromise,
    weekObsPromise,
    attainmentPromise,
    meetingsTodayPromise,
    hasAssessmentsFeature
      ? fetchHomeAttainmentHeadline(user.tenantId)
      : Promise.resolve({ gcse: null, aLevel: null } as HomeAttainmentHeadline),
    safe(fetchAttendanceHeadline(user.tenantId), { attendancePct: null, yesterdayPct: null, yesterdayLatenessPct: null, studentsCovered: 0, asOf: null } as AttendanceHeadline),
  ]);

  return {
    cpdRows,
    teacherRows,
    cohortRows: cohortResult.rows,
    studentRows: studentResult.rows,
    topImproving: getTopImprovingSignals(cpdRows),
    pendingLeaveCount: pendingLeaveCount as number,
    liveOnCallBanner: liveOnCallBanner as { count: number; latest: OnCallDetail | null },
    pendingLeaveDetails,
    onCallDetails,
    onCallStats: onCallStats as { resolved: number; active: number; escalation: number },
    weekObsCount: weekObs.count,
    weekObsTeachers: weekObs.recentTeachers,
    attainmentSummary,
    attainmentHeadline,
    attendanceHeadline,
    meetingsTodayCount: meetingsTodayCount as number,
    watchlistStudents: studentResult.rows.filter((r) => r.onWatchlist),
  };
}

/* ── Attainment headline (GCSE / A-Level key measures) ──────────────── */

export type GcseAttainmentHeadline = {
  cycleLabel: string;
  pointLabel: string;
  /** Students with both English Language and Maths present, i.e. the E&M Basics cohort. */
  presentCount: number;
  em4: number | null;
  em5: number | null;
  em7: number | null;
  /** Average point score (1–9 scale) across every GCSE entry recorded at this point. */
  aps: number | null;
  apsEntryCount: number;
};

export type ALevelAttainmentHeadline = {
  cycleLabel: string;
  pointLabel: string;
  presentCount: number;
  aStarAPct: number;
  aStarBPct: number;
  aStarCPct: number;
  /** e.g. "B-", "B", "B+" -- null when no entry has a recognised grade. */
  averageGrade: string | null;
  averageGradeEntryCount: number;
};

export type HomeAttainmentHeadline = {
  gcse: GcseAttainmentHeadline | null;
  aLevel: ALevelAttainmentHeadline | null;
};

const A_LEVEL_SCORE: Record<string, number> = { "A*": 7, A: 6, B: 5, C: 4, D: 3, E: 2, U: 1 };
const A_LEVEL_GRADE_LABELS = ["U", "E", "D", "C", "B", "A", "A*"];

/**
 * Formats a mean A-Level score (1 = U .. 7 = A*) as a letter grade with a
 * +/- modifier, the way schools commonly display a cohort average that
 * naturally falls between two certificate grades (e.g. 4.3 -> "C+").
 * A* has no "+" (nothing above it) and U has no "-" (nothing below it).
 */
function formatALevelAverageGrade(avgScore: number): string | null {
  if (!Number.isFinite(avgScore)) return null;
  const idx = Math.min(6, Math.max(0, avgScore - 1));
  const base = Math.round(idx);
  const diff = idx - base;
  const label = A_LEVEL_GRADE_LABELS[base];
  if (diff > 1 / 6 && base < 6) return `${label}+`;
  if (diff < -1 / 6 && base > 0) return `${label}-`;
  return label;
}

function academicYearEndDate(cycle: { academicYear: string; label: string; endDate: Date }) {
  const startYear = Number((cycle.academicYear.match(/(20\d{2})/) ?? cycle.label.match(/(20\d{2})/))?.[1]);
  // Arbor imports can be created with an unreliable start date. The academic-year
  // label is the authoritative ordering key for a school assessment cycle.
  return Number.isFinite(startYear)
    ? new Date(Date.UTC(startYear + 1, 7, 31, 23, 59, 59, 999))
    : cycle.endDate;
}

/** The most recent result point with real grades. Cycles can be created manually
 * or synced from Arbor, so `isActive`, creation time, and import order cannot be
 * used to determine recency. */
async function findLatestAssessedPoint(tenantId: string, qualificationType: "GCSE" | "A_LEVEL") {
  const cycles = await (prisma as any).assessmentCycle.findMany({
    where: { tenantId, qualificationType },
    include: {
      points: {
        orderBy: [{ dateTaken: "desc" }, { assessedAt: "desc" }, { ordinal: "desc" }],
        include: {
          assessments: {
            select: {
              subject: true,
              results: {
                select: { studentId: true, status: true, normalizedScore: true, rawValue: true },
              },
            },
          },
        },
      },
    },
  });

  const candidates = (cycles as any[]).flatMap((cycle) =>
    (cycle.points ?? [])
      .filter((point: any) => (point.assessments ?? []).some((assessment: any) => (assessment.results ?? []).length > 0))
      .map((point: any) => ({
        cycleLabel: cycle.label as string,
        cycleRecency: academicYearEndDate(cycle),
        pointRecency: point.dateTaken ?? point.assessedAt,
        point,
      }))
  );

  candidates.sort((a, b) =>
    b.cycleRecency.getTime() - a.cycleRecency.getTime()
    || new Date(b.pointRecency).getTime() - new Date(a.pointRecency).getTime()
    || b.point.ordinal - a.point.ordinal
  );
  const latest = candidates[0];
  return latest ? { cycleLabel: latest.cycleLabel, point: latest.point } : null;
}

async function fetchGcseHeadline(tenantId: string): Promise<GcseAttainmentHeadline | null> {
  const found = await findLatestAssessedPoint(tenantId, "GCSE");
  if (!found) return null;
  const { cycleLabel, point } = found;
  const assessments: any[] = point.assessments ?? [];

  const engA = assessments.find((a) => /english/i.test(a.subject) && !/lit/i.test(a.subject));
  const mathsA = assessments.find((a) => /maths?/i.test(a.subject));

  let em4: number | null = null;
  let em5: number | null = null;
  let em7: number | null = null;
  let presentCount = 0;

  if (engA && mathsA) {
    const engMap = new Map(engA.results.map((r: any) => [r.studentId, r]));
    const mathsMap = new Map(mathsA.results.map((r: any) => [r.studentId, r]));
    const allIds = [...new Set([...engMap.keys(), ...mathsMap.keys()])];
    const bothPresent = allIds.filter(
      (id) => (engMap.get(id) as any)?.status === "PRESENT" && (mathsMap.get(id) as any)?.status === "PRESENT"
    );
    presentCount = bothPresent.length;

    const bothAt = (t: number): number | null => {
      if (bothPresent.length === 0) return null;
      const met = bothPresent.filter((id) => {
        const eg = (engMap.get(id) as any).normalizedScore;
        const mg = (mathsMap.get(id) as any).normalizedScore;
        return eg !== null && mg !== null && meetsGcseThreshold(eg, t) && meetsGcseThreshold(mg, t);
      });
      return Math.round((met.length / bothPresent.length) * 100);
    };

    em4 = bothAt(4);
    em5 = bothAt(5);
    em7 = bothAt(7);
  }

  const allScores = assessments
    .flatMap((a) => a.results)
    .filter((r: any) => r.status === "PRESENT" && r.normalizedScore !== null)
    .map((r: any) => r.normalizedScore as number);
  const aps =
    allScores.length > 0
      ? Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 9 * 10) / 10
      : null;

  return {
    cycleLabel,
    pointLabel: point.label as string,
    presentCount,
    em4,
    em5,
    em7,
    aps,
    apsEntryCount: allScores.length,
  };
}

async function fetchALevelHeadline(tenantId: string): Promise<ALevelAttainmentHeadline | null> {
  const found = await findLatestAssessedPoint(tenantId, "A_LEVEL");
  if (!found) return null;
  const { cycleLabel, point } = found;
  const assessments: any[] = point.assessments ?? [];
  const allResults = assessments.flatMap((a) => a.results).filter((r: any) => r.status === "PRESENT");
  if (allResults.length === 0) return null;

  const scoreOf = (r: any) => A_LEVEL_SCORE[String(r.rawValue ?? "").trim().toUpperCase()] ?? 0;
  const total = allResults.length;
  const gradedScores = allResults.map(scoreOf).filter((s) => s > 0);

  return {
    cycleLabel,
    pointLabel: point.label as string,
    presentCount: total,
    aStarAPct: Math.round((allResults.filter((r: any) => scoreOf(r) >= 6).length / total) * 100),
    aStarBPct: Math.round((allResults.filter((r: any) => scoreOf(r) >= 5).length / total) * 100),
    aStarCPct: Math.round((allResults.filter((r: any) => scoreOf(r) >= 4).length / total) * 100),
    averageGrade:
      gradedScores.length > 0
        ? formatALevelAverageGrade(gradedScores.reduce((a, b) => a + b, 0) / gradedScores.length)
        : null,
    averageGradeEntryCount: gradedScores.length,
  };
}

/**
 * Headline attainment measures for the home page: GCSE English & Maths 4+/5+/7+ plus
 * average point score, and A-Level %A*–A / %A*–B / %A*–C plus average grade — each
 * from the latest assessed result point in the tenant's current active cycle of
 * that qualification type.
 */
export async function fetchHomeAttainmentHeadline(tenantId: string): Promise<HomeAttainmentHeadline> {
  const [gcse, aLevel] = await Promise.all([
    safe(fetchGcseHeadline(tenantId), null as GcseAttainmentHeadline | null),
    safe(fetchALevelHeadline(tenantId), null as ALevelAttainmentHeadline | null),
  ]);
  return { gcse, aLevel };
}

/* ── Behaviour Heatmap ───────────────────────────────────────────── */

export type HeatmapCellIncident = {
  id: string;
  createdAt: string;
  studentName: string;
  studentYearGroup: string | null;
  requesterName: string;
  behaviourReasonCategory: string | null;
  status: string;
  location: string;
};

export type BehaviourHeatmapData = {
  yearGroups: string[];
  /** Day-of-week labels for the columns (e.g. ["Mon", "Tue", "Wed", "Thu", "Fri"]). */
  columnLabels: string[];
  /** matrix[rowIndex][colIndex] = incident count */
  matrix: number[][];
  /** incidents[rowIndex][colIndex] = list of incidents for that cell */
  incidents: HeatmapCellIncident[][][];
};

const DOW_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

/**
 * Builds a year-group × weekday behaviour heatmap from on-call request counts.
 * Only counts Mon–Fri incidents. Year groups are sorted by natural order.
 */
export async function fetchBehaviourHeatmapMatrix(
  tenantId: string,
  windowDays: number
): Promise<BehaviourHeatmapData | null> {
  return safe(
    (async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - windowDays);

      const requests = await (prisma as any).onCallRequest.findMany({
        where: { tenantId, createdAt: { gte: startDate } },
        include: {
          student: { select: { yearGroup: true, fullName: true } },
          requester: { select: { fullName: true } },
        },
        orderBy: { createdAt: "asc" },
      });

      if (!requests || (requests as any[]).length === 0) return null;

      // Accumulate counts and incidents: yearGroup → dow (1=Mon … 5=Fri)
      const counts: Record<string, Record<number, number>> = {};
      const incidentsByCell: Record<string, Record<number, HeatmapCellIncident[]>> = {};

      for (const req of requests as any[]) {
        const yg: string = req.student?.yearGroup ?? "Unknown";
        // getDay(): 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
        const dow = new Date(req.createdAt as Date).getDay();
        if (dow < 1 || dow > 5) continue; // skip weekends
        if (!counts[yg]) counts[yg] = {};
        counts[yg][dow] = (counts[yg][dow] ?? 0) + 1;
        if (!incidentsByCell[yg]) incidentsByCell[yg] = {};
        if (!incidentsByCell[yg][dow]) incidentsByCell[yg][dow] = [];
        incidentsByCell[yg][dow].push({
          id: req.id as string,
          createdAt: (req.createdAt as Date).toISOString(),
          studentName: (req.student?.fullName as string) ?? "—",
          studentYearGroup: (req.student?.yearGroup as string | null) ?? null,
          requesterName: (req.requester?.fullName as string) ?? "—",
          behaviourReasonCategory: (req.behaviourReasonCategory as string | null) ?? null,
          status: req.status as string,
          location: (req.location as string) ?? "",
        });
      }

      const yearGroups = Object.keys(counts).sort((a, b) => {
        // Sort by year number extracted from label
        const numA = parseInt(a.replace(/\D/g, ""), 10);
        const numB = parseInt(b.replace(/\D/g, ""), 10);
        return (isNaN(numA) ? 999 : numA) - (isNaN(numB) ? 999 : numB);
      });

      if (yearGroups.length === 0) return null;

      // Build matrix and incidents: rows = yearGroups, cols = Mon(1)…Fri(5)
      const matrix = yearGroups.map((yg) =>
        [1, 2, 3, 4, 5].map((dow) => counts[yg]?.[dow] ?? 0)
      );
      const incidents = yearGroups.map((yg) =>
        [1, 2, 3, 4, 5].map((dow) => incidentsByCell[yg]?.[dow] ?? [])
      );

      return { yearGroups, columnLabels: DOW_LABELS, matrix, incidents };
    })(),
    null as BehaviourHeatmapData | null
  );
}

export async function hydrateHodHomeData({
  user,
  windowDays,
  searchDeptId,
}: {
  user: SessionUser;
  windowDays: number;
  searchDeptId?: string | null;
}) {
  const hodMemberships = await safe(
    (prisma as any).departmentMembership.findMany({
      where: { userId: user.id, isHeadOfDepartment: true },
      include: { department: true },
    }),
    [] as any[]
  );

  const allDepts: { id: string; name: string }[] = (hodMemberships as any[]).map((m: any) => ({
    id: m.departmentId as string,
    name: m.department.name as string,
  }));

  const activeDeptId: string | null =
    searchDeptId && allDepts.find((d) => d.id === searchDeptId) ? searchDeptId : allDepts[0]?.id ?? null;

  if (!activeDeptId) {
    return {
      allDepts,
      activeDeptId: null,
      deptName: "",
      deptCpdRows: [] as CpdPriorityRow[],
      filteredTeacherRows: [] as TeacherRiskRow[],
      selfProfile: null,
      wholeSchoolTop1: null as CpdPriorityRow | null,
    };
  }

  const deptName = allDepts.find((d) => d.id === activeDeptId)?.name ?? "";

  const [deptCpdRows, deptTeacherRows, selfProfile, wholeSchoolCpd, deptMemberships] = await Promise.all([
    safe(computeCpdPriorities(user.tenantId, windowDays, { departmentId: activeDeptId }), [] as CpdPriorityRow[]),
    safe(computeTeacherRiskIndex(user.tenantId, windowDays), [] as TeacherRiskRow[]),
    safe(computeTeacherSignalProfile(user.tenantId, user.id, windowDays), null),
    safe(computeCpdPriorities(user.tenantId, windowDays), [] as CpdPriorityRow[]),
    safe(
      (prisma as any).departmentMembership.findMany({
        where: { tenantId: user.tenantId, departmentId: activeDeptId },
      }),
      [] as any[]
    ),
  ]);

  const deptUserIds = new Set<string>((deptMemberships as any[]).map((m: any) => m.userId as string));
  const filteredTeacherRows = (deptTeacherRows as TeacherRiskRow[]).filter((r) =>
    deptUserIds.has(r.teacherMembershipId)
  );
  const wholeSchoolTop1 = wholeSchoolCpd.find((r) => r.teachersDriftingDown > 0) ?? null;

  return {
    allDepts,
    activeDeptId,
    deptName,
    deptCpdRows,
    filteredTeacherRows,
    selfProfile,
    wholeSchoolTop1,
  };
}

export async function hydrateTeacherHomeData({
  user,
  windowDays,
  hasAnalysisFeature,
  assembly,
}: {
  user: SessionUser;
  windowDays: number;
  hasAnalysisFeature: boolean;
  assembly: HomeAssembly;
}) {
  const selfProfilePromise =
    hasAnalysisFeature && assembly.has("observe.my-observation-profile")
      ? safe(computeTeacherSignalProfile(user.tenantId, user.id, windowDays), null)
      : Promise.resolve(null);

  const wholeSchoolCpdPromise =
    hasAnalysisFeature && assembly.has("observe.whole-school-focus")
      ? safe(computeCpdPriorities(user.tenantId, windowDays), [] as CpdPriorityRow[])
      : Promise.resolve([] as CpdPriorityRow[]);

  const loaDataPromise = assembly.has("operations.my-leave-status")
    ? safe(
        (prisma as any).lOARequest.findFirst({
          where: { tenantId: user.tenantId, requesterId: user.id },
          orderBy: { createdAt: "desc" },
        }),
        null
      )
    : Promise.resolve(null);

  const onCallDataPromise = assembly.has("culture.my-oncall-status")
    ? safe(
        (prisma as any).onCallRequest.findMany({
          where: { tenantId: user.tenantId, requesterUserId: user.id },
          orderBy: { createdAt: "desc" },
          take: 3,
        }),
        [] as any[]
      )
    : Promise.resolve([] as any[]);

  const openActionsDataPromise = assembly.has("operations.my-open-actions")
    ? safe(
        (prisma as any).meetingAction.findMany({
          where: { tenantId: user.tenantId, ownerUserId: user.id, status: "OPEN" },
          orderBy: [{ dueDate: "asc" }],
          take: 5,
        }),
        [] as any[]
      )
    : Promise.resolve([] as any[]);

  const meetingsTodayPromise = assembly.has("operations.meetings-today")
    ? safe(
        (async () => {
          const start = new Date();
          start.setHours(0, 0, 0, 0);
          const end = new Date();
          end.setHours(23, 59, 59, 999);
          const rows = await (prisma as any).meeting.findMany({
            where: {
              tenantId: user.tenantId,
              startDateTime: { gte: start, lte: end },
              OR: [{ createdByUserId: user.id }, { attendees: { some: { userId: user.id } } }],
            },
            orderBy: { startDateTime: "asc" },
            take: 5,
            select: { id: true, title: true, startDateTime: true, location: true },
          });
          return rows as { id: string; title: string; startDateTime: Date; location: string | null }[];
        })(),
        [] as { id: string; title: string; startDateTime: Date; location: string | null }[]
      )
    : Promise.resolve([] as { id: string; title: string; startDateTime: Date; location: string | null }[]);

  const [selfProfile, wholeSchoolCpd, loaData, onCallData, openActionsData, meetingsToday] = await Promise.all([
    selfProfilePromise,
    wholeSchoolCpdPromise,
    loaDataPromise,
    onCallDataPromise,
    openActionsDataPromise,
    meetingsTodayPromise,
  ]);

  const wholeSchoolTop1 = (wholeSchoolCpd as CpdPriorityRow[]).find((r) => r.teachersDriftingDown > 0) ?? null;

  return {
    selfProfile,
    wholeSchoolTop1,
    loaData,
    onCallData,
    openActionsData,
    meetingsToday,
  };
}

export async function hydrateCoachHomeData({
  user,
  windowDays,
  assembly,
}: {
  user: SessionUser;
  windowDays: number;
  assembly: HomeAssembly;
}) {
  const coachAssignments = await safe(
    (prisma as any).coachAssignment.findMany({ where: { coachUserId: user.id } }),
    [] as { coacheeUserId: string }[]
  );
  const coacheeIds = (coachAssignments as { coacheeUserId: string }[]).map((a) => a.coacheeUserId);

  const teacherHome = await hydrateTeacherHomeData({
    user,
    windowDays,
    hasAnalysisFeature: true,
    assembly,
  });

  if (coacheeIds.length === 0) {
    return { ...teacherHome, coacheeIds, coacheeRows: [] as TeacherRiskRow[] };
  }

  const allTeacherRows = await safe(computeTeacherRiskIndex(user.tenantId, windowDays), [] as TeacherRiskRow[]);
  const coacheeRows = (allTeacherRows as TeacherRiskRow[])
    .filter((r) => coacheeIds.includes(r.teacherMembershipId))
    .filter((r) => r.status === "SIGNIFICANT_DRIFT" || r.status === "EMERGING_DRIFT")
    .slice(0, 8);

  return { ...teacherHome, coacheeIds, coacheeRows };
}

export type HodAttentionContext = {
  liveOnCallCount: number;
  latestLiveOnCall: OnCallDetail | null;
  pendingLeaveCount: number;
  urgentStudentCount: number;
};

export async function hydrateHodAttentionContext({
  user,
  deptId,
  windowDays,
  hasLeaveFeature,
  hasOnCallFeature,
  hasStudentAnalysisFeature,
}: {
  user: SessionUser;
  deptId: string;
  windowDays: number;
  hasLeaveFeature: boolean;
  hasOnCallFeature: boolean;
  hasStudentAnalysisFeature: boolean;
}): Promise<HodAttentionContext> {
  const deptMemberships = await safe(
    (prisma as any).departmentMembership.findMany({
      where: { tenantId: user.tenantId, departmentId: deptId },
      select: { userId: true },
    }),
    [] as { userId: string }[]
  );
  const deptUserIds = new Set(deptMemberships.map((m) => m.userId));

  const liveOnCallPromise = hasOnCallFeature
    ? safe(
        Promise.all([
          (prisma as any).onCallRequest.count({
            where: { tenantId: user.tenantId, status: { in: ["OPEN", "ACKNOWLEDGED"] } },
          }),
          (prisma as any).onCallRequest.findFirst({
            where: { tenantId: user.tenantId, status: { in: ["OPEN", "ACKNOWLEDGED"] } },
            orderBy: { createdAt: "desc" },
            include: { requester: { select: { fullName: true } } },
          }),
        ]).then(([count, r]: [number, any]) => ({
          count,
          latest: r
            ? ({
                id: r.id as string,
                requesterName: (r.requester?.fullName ?? "Unknown") as string,
                location: (r.location ?? "") as string,
                status: r.status as string,
                createdAt: (r.createdAt as Date).toISOString(),
                resolvedAt: r.resolvedAt ? (r.resolvedAt as Date).toISOString() : null,
              } satisfies OnCallDetail)
            : null,
        })),
        { count: 0, latest: null as OnCallDetail | null }
      )
    : Promise.resolve({ count: 0, latest: null as OnCallDetail | null });

  const pendingLeavePromise = hasLeaveFeature
    ? safe(
        (prisma as any).lOARequest.count({
          where: { tenantId: user.tenantId, status: "PENDING", requesterId: { in: [...deptUserIds] } },
        }),
        0
      )
    : Promise.resolve(0);

  const urgentStudentsPromise = hasStudentAnalysisFeature
    ? safe(computeStudentRiskIndex(user.tenantId, windowDays, user.id), {
        rows: [] as StudentRiskRow[],
        computedAt: new Date(),
      }).then((res) => res.rows.filter((s) => s.band === "URGENT" || s.band === "PRIORITY").length)
    : Promise.resolve(0);

  const [liveOnCall, pendingLeaveCount, urgentStudentCount] = await Promise.all([
    liveOnCallPromise,
    pendingLeavePromise,
    urgentStudentsPromise,
  ]);

  return {
    liveOnCallCount: liveOnCall.count,
    latestLiveOnCall: liveOnCall.latest,
    pendingLeaveCount: pendingLeaveCount as number,
    urgentStudentCount,
  };
}
