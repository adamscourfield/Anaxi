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

  const [cpdRows, teacherRows, cohortResult, studentResult, pendingLeaveCount, liveOnCallBanner, pendingLeaveDetails, onCallDetails, onCallStats, weekObs, attainmentSummary] = await Promise.all([
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
    watchlistStudents: studentResult.rows,
  };
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

  const [selfProfile, wholeSchoolCpd, loaData, onCallData, openActionsData] = await Promise.all([
    selfProfilePromise,
    wholeSchoolCpdPromise,
    loaDataPromise,
    onCallDataPromise,
    openActionsDataPromise,
  ]);

  const wholeSchoolTop1 = (wholeSchoolCpd as CpdPriorityRow[]).find((r) => r.teachersDriftingDown > 0) ?? null;

  return {
    selfProfile,
    wholeSchoolTop1,
    loaData,
    onCallData,
    openActionsData,
  };
}
