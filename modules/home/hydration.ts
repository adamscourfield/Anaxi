import { prisma } from "@/lib/prisma";
import { SessionUser } from "@/lib/types";
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

export type PendingLeaveDetail = {
  id: string;
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
        (prisma as any).lOARequest.count({
          where: { tenantId: user.tenantId, status: "PENDING" },
        }),
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
        (prisma as any).lOARequest
          .findMany({
            where: { tenantId: user.tenantId, status: "PENDING" },
            include: { requester: { select: { fullName: true } }, reason: { select: { label: true } } },
            orderBy: { createdAt: "desc" },
            take: 3,
          })
          .then((rows: any[]) =>
            rows.map((r: any) => ({
              id: r.id as string,
              requesterName: (r.requester?.fullName ?? "Unknown") as string,
              reasonLabel: (r.reason?.label ?? null) as string | null,
              startDate: (r.startDate as Date).toISOString(),
              endDate: (r.endDate as Date).toISOString(),
              notes: r.notes as string | null,
              status: r.status as string,
              createdAt: (r.createdAt as Date).toISOString(),
            }))
          ),
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

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const meetingsTodayPromise = safe(
    (prisma as any).meeting.count({
      where: {
        tenantId: user.tenantId,
        startDateTime: { gte: startOfToday, lte: endOfToday },
      },
    }),
    0 as number
  );

  const weekObsPromise = safe(
    (prisma as any).observation
      .findMany({
        where: { tenantId: user.tenantId, observedAt: { gte: weekAgo } },
        include: { observedTeacher: { select: { fullName: true } } },
        orderBy: { observedAt: "desc" },
        take: 20,
      })
      .then((rows: any[]) => {
        const seen = new Set<string>();
        const recentTeachers: { id: string; name: string }[] = [];
        for (const r of rows) {
          const tid = r.observedTeacherId as string;
          if (!seen.has(tid)) {
            seen.add(tid);
            recentTeachers.push({ id: tid, name: (r.observedTeacher?.fullName ?? "Unknown") as string });
          }
          if (recentTeachers.length >= 5) break;
        }
        return { count: rows.length, recentTeachers };
      }),
    { count: 0, recentTeachers: [] as { id: string; name: string }[] }
  );

  const [cpdRows, teacherRows, cohortResult, studentResult, pendingLeaveCount, liveOnCallBanner, pendingLeaveDetails, onCallDetails, onCallStats, weekObs, attainmentSummary, meetingsTodayCount, attainmentKpis] = await Promise.all([
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
    hasAssessmentsFeature ? fetchDashboardAttainmentKPIs(user.tenantId) : Promise.resolve([] as DashboardAttainmentKPIRow[]),
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
    attainmentKpis,
    meetingsTodayCount: meetingsTodayCount as number,
    watchlistStudents: studentResult.rows,
  };
}

/* ── Attainment KPI panel ────────────────────────────────────────── */

export type DashboardAttainmentKPIRow = {
  label: string;
  /** Primary displayed number. Delta is shown as "+/-" if delta !== null, else as plain value. */
  value: number;
  delta: number | null;
  /** Ordered series of average normalised scores (0–1) for sparkline rendering. */
  sparkline: number[];
};

const KS4_YEAR_GROUPS = ["Year 10", "Year 11", "10", "11"];
const KS5_YEAR_GROUPS = ["Year 12", "Year 13", "12", "13"];

function matchesYearGroups(yg: string, targets: string[]): boolean {
  return targets.some((t) => yg === t || yg.includes(t));
}

/**
 * Fetches attainment KPI rows for the dashboard Attainment panel.
 * Returns up to 3 rows: KS4 Progress 8 proxy, KS4 Attainment 8 proxy, KS5 Progress proxy.
 * Falls back to empty array if no assessment data exists.
 */
export async function fetchDashboardAttainmentKPIs(
  tenantId: string
): Promise<DashboardAttainmentKPIRow[]> {
  return safe(
    (async () => {
      const cycle = await (prisma as any).assessmentCycle.findFirst({
        where: { tenantId, isActive: true },
        include: {
          points: {
            orderBy: { ordinal: "asc" },
            include: {
              assessments: {
                select: {
                  yearGroup: true,
                  results: { select: { normalizedScore: true } },
                },
              },
            },
          },
        },
      });

      if (!cycle) return [];

      const points: any[] = cycle.points ?? [];
      if (points.length === 0) return [];

      // For each assessment point, compute avg normalised score by key stage
      const ks4Series: number[] = [];
      const ks5Series: number[] = [];

      for (const point of points) {
        const assessments: any[] = point.assessments ?? [];
        const ks4Scores: number[] = [];
        const ks5Scores: number[] = [];

        for (const assessment of assessments) {
          const yg: string = assessment.yearGroup ?? "";
          const results: any[] = assessment.results ?? [];
          const scores = results
            .filter((r: any) => r.normalizedScore !== null)
            .map((r: any) => r.normalizedScore as number);

          if (scores.length === 0) continue;
          const avg = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;

          if (matchesYearGroups(yg, KS4_YEAR_GROUPS)) ks4Scores.push(avg);
          if (matchesYearGroups(yg, KS5_YEAR_GROUPS)) ks5Scores.push(avg);
        }

        if (ks4Scores.length > 0) {
          ks4Series.push(ks4Scores.reduce((a, b) => a + b, 0) / ks4Scores.length);
        }
        if (ks5Scores.length > 0) {
          ks5Series.push(ks5Scores.reduce((a, b) => a + b, 0) / ks5Scores.length);
        }
      }

      const rows: DashboardAttainmentKPIRow[] = [];

      // KS4 Progress 8 proxy — expressed as normalised delta (+/-) between first and last point
      if (ks4Series.length >= 2) {
        const first = ks4Series[0];
        const last = ks4Series[ks4Series.length - 1];
        const progressDelta = parseFloat(((last - first) * 4).toFixed(2)); // scale 0-1 → 0-4 range
        rows.push({
          label: "KS4 Progress 8",
          value: progressDelta,
          delta: progressDelta,
          sparkline: ks4Series,
        });
      } else if (ks4Series.length === 1) {
        rows.push({
          label: "KS4 Progress 8",
          value: 0,
          delta: 0,
          sparkline: ks4Series,
        });
      }

      // KS4 Attainment 8 proxy — last point avg mapped to 0-80 Att8 scale
      if (ks4Series.length > 0) {
        const lastKs4 = ks4Series[ks4Series.length - 1];
        const att8 = parseFloat((lastKs4 * 80).toFixed(1));
        rows.push({
          label: "KS4 Attainment 8",
          value: att8,
          delta: null,
          sparkline: ks4Series.map((v) => v * 80),
        });
      }

      // KS5 Progress proxy
      if (ks5Series.length >= 2) {
        const first = ks5Series[0];
        const last = ks5Series[ks5Series.length - 1];
        const progressDelta = parseFloat(((last - first) * 4).toFixed(2));
        rows.push({
          label: "KS5 Progress",
          value: progressDelta,
          delta: progressDelta,
          sparkline: ks5Series,
        });
      } else if (ks5Series.length === 1) {
        rows.push({
          label: "KS5 Progress",
          value: 0,
          delta: 0,
          sparkline: ks5Series,
        });
      }

      return rows;
    })(),
    [] as DashboardAttainmentKPIRow[]
  );
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
