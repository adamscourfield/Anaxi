import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { buildViewerContext } from "@/lib/viewerContext";
import { PageHeader } from "@/components/ui/page-header";
import {
  canViewExplorer,
  canViewBehaviourExplorer,
  canViewAssessmentExplorer,
  canViewTeacherAnalysis,
} from "@/modules/authz";
import { computeTeacherRiskIndex } from "@/modules/analysis/teacherRisk";
import { computeDepartmentPivot } from "@/modules/analysis/departmentPivot";
import { computeStudentRiskIndex } from "@/modules/analysis/studentRisk";
import { computeCohortPivot } from "@/modules/analysis/cohortPivot";
import { computeCpdPriorities } from "@/modules/analysis/cpdPriorities";
import { computeAssessmentAnalysis } from "@/modules/analysis/assessmentAnalysis";

const WINDOW_DAYS = 21;
const MAX_DRIFT_LOG_ENTRIES = 3;
const MAX_LOG_ENTRIES = 5;

/* ─── Inline SVG icons ─────────────────────────────────────────────────────── */

function IconTeachers() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
    </svg>
  );
}

function IconDepartments() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
    </svg>
  );
}

function IconSignals() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.348 14.652a3.75 3.75 0 0 1 0-5.304m5.304 0a3.75 3.75 0 0 1 0 5.304m-7.425 2.121a6.75 6.75 0 0 1 0-9.546m9.546 0a6.75 6.75 0 0 1 0 9.546M5.106 18.894c-3.808-3.807-3.808-9.98 0-13.788m13.788 0c3.808 3.807 3.808 9.98 0 13.788M12 12h.008v.008H12V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
    </svg>
  );
}

function IconObservations() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  );
}

function IconAssessment() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
    </svg>
  );
}

function IconBehaviour() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
    </svg>
  );
}

function formatLogTime(d: Date): string {
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export default async function ExplorerPage() {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ANALYSIS");

  const viewerContext = await buildViewerContext(user);

  if (!canViewExplorer(viewerContext)) notFound();
  const canSeeBehaviour = canViewBehaviourExplorer(viewerContext);
  const canSeeAssessment = canViewAssessmentExplorer(viewerContext);

  // ─── Fetch hub summary data in parallel ─────────────────────────────────────
  const since = new Date();
  since.setDate(since.getDate() - WINDOW_DAYS);

  const [
    teacherRiskRows,
    deptResult,
    cpdRows,
    obsCount,
    recentObservations,
    deptMemberships,
    studentRiskResult,
    cohortPivotResult,
    assessmentRes,
  ] = await Promise.all([
    computeTeacherRiskIndex(user.tenantId, WINDOW_DAYS),
    computeDepartmentPivot(user.tenantId, WINDOW_DAYS),
    computeCpdPriorities(user.tenantId, WINDOW_DAYS),
    (prisma as any).observation.count({
      where: { tenantId: user.tenantId, observedAt: { gte: since } },
    }) as Promise<number>,
    (prisma as any).observation.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { observedAt: "desc" },
      take: 5,
      select: {
        id: true,
        observedAt: true,
        yearGroup: true,
        subject: true,
        observer: { select: { fullName: true } },
      },
    }) as Promise<{ id: string; observedAt: Date; yearGroup: string; subject: string; observer: { fullName: string } }[]>,
    (prisma as any).departmentMembership.findMany({
      where: { tenantId: user.tenantId },
      select: { userId: true, departmentId: true },
    }) as Promise<{ userId: string; departmentId: string }[]>,
    canSeeBehaviour ? computeStudentRiskIndex(user.tenantId, WINDOW_DAYS, user.id) : Promise.resolve(null),
    canSeeBehaviour ? computeCohortPivot(user.tenantId, WINDOW_DAYS) : Promise.resolve(null),
    canSeeAssessment ? computeAssessmentAnalysis(user.tenantId) : Promise.resolve(null),
  ]);

  // ─── Derive summary stats ───────────────────────────────────────────────────
  const driftingTeachers = teacherRiskRows.filter(
    (r) => r.status === "SIGNIFICANT_DRIFT" || r.status === "EMERGING_DRIFT",
  ).length;
  const totalTeachers = teacherRiskRows.length;

  const totalDepartments = deptResult.rows.length;
  const totalObsAcrossDepts = deptResult.rows.reduce((s, r) => s + r.observationCount, 0);

  const highPrioritySignals = cpdRows.filter((r) => r.priorityScore > 0.1).length;
  const totalSignals = cpdRows.length;

  const teacherDepts = new Map<string, string[]>();
  for (const m of deptMemberships as { userId: string; departmentId: string }[]) {
    if (!teacherDepts.has(m.userId)) teacherDepts.set(m.userId, []);
    teacherDepts.get(m.userId)!.push(m.departmentId);
  }

  const visibleTeacherRisk = teacherRiskRows.filter((row) =>
    canViewTeacherAnalysis(viewerContext, {
      teacherUserId: row.teacherMembershipId,
      teacherDepartmentIds: teacherDepts.get(row.teacherMembershipId) ?? [],
    }),
  );

  const teacherStatusShort: Record<string, string> = {
    SIGNIFICANT_DRIFT: "Significant drift",
    EMERGING_DRIFT: "Emerging drift",
    STABLE: "Stable",
    LOW_COVERAGE: "Low coverage",
  };

  const topTeacherPriorities = visibleTeacherRisk
    .filter((r) => r.status === "SIGNIFICANT_DRIFT" || r.status === "EMERGING_DRIFT")
    .sort((a, b) => b.normalizedIDS - a.normalizedIDS)
    .slice(0, 3);

  const topCpdPriorities = cpdRows
    .filter((r) => r.teachersCovered > 0 && r.priorityScore > 0)
    .slice(0, 3);

  let urgentStudents = 0;
  let totalStudents = 0;
  let yearGroupCount = 0;
  let academicLoadPct = 0;

  if (canSeeBehaviour && studentRiskResult && cohortPivotResult) {
    urgentStudents = studentRiskResult.rows.filter(
      (r) => r.band === "PRIORITY" || r.band === "URGENT",
    ).length;
    totalStudents = studentRiskResult.rows.length;
    yearGroupCount = cohortPivotResult.rows.length;

    const attendanceValues = cohortPivotResult.rows
      .map((r) => r.attendanceMean)
      .filter((v): v is number => v !== null);
    academicLoadPct = attendanceValues.length > 0
      ? Math.round(attendanceValues.reduce((a, b) => a + b, 0) / attendanceValues.length)
      : 0;
  }

  let topStudentPriorities: { studentId: string; studentName: string; band: string }[] = [];
  if (canSeeBehaviour && studentRiskResult) {
    topStudentPriorities = studentRiskResult.rows
      .filter((r) => r.band === "PRIORITY" || r.band === "URGENT")
      .slice(0, 3)
      .map((r) => ({
        studentId: r.studentId,
        studentName: r.studentName,
        band: r.band === "URGENT" ? "Urgent" : "Priority",
      }));
  }

  // ── Assessment summary ────────────────────────────────────────────────────
  const assessmentResult = assessmentRes as Awaited<ReturnType<typeof computeAssessmentAnalysis>> | null;

  let assessmentStudentsTracked = 0;
  let assessmentValueAddConcerns = 0;
  let assessmentSendGap: number | null = null;
  let topAssessmentPriorities: { teacherName: string; subject: string; valueAdd: number }[] = [];

  if (assessmentResult) {
    assessmentStudentsTracked = assessmentResult.students.length;
    assessmentValueAddConcerns = assessmentResult.teachers
      .flatMap((t) => t.subjects.filter((s) => typeof s.valueAdd === "number" && (s.valueAdd as number) < -0.05))
      .length;

    const sendGaps = assessmentResult.cohorts
      .map((c) => c.sendGap)
      .filter((v): v is number => v !== null);
    assessmentSendGap = sendGaps.length > 0
      ? sendGaps.reduce((a, b) => a + b, 0) / sendGaps.length
      : null;

    topAssessmentPriorities = assessmentResult.teachers
      .flatMap((t) =>
        t.subjects
          .filter((s) => typeof s.valueAdd === "number" && (s.valueAdd as number) < -0.05)
          .map((s) => ({ teacherName: t.teacherName, subject: s.subject, valueAdd: s.valueAdd as number })),
      )
      .sort((a, b) => a.valueAdd - b.valueAdd)
      .slice(0, 3);
  }

  const computedAt = deptResult.computedAt;
  const computedAtStr = computedAt.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // ─── Build intelligence log entries ─────────────────────────────────────────
  type LogEntry = {
    id: string;
    icon: "observation" | "signal";
    href: string;
    at: number;
    timeLabel: string;
    headlinePrefix: string | null;
    emphasisText: string | null;
    plainTitle: string | null;
    tagLabel: string;
    tagVariant: "academic" | "priority";
  };

  const logEntries: LogEntry[] = [];

  for (const obs of recentObservations) {
    logEntries.push({
      id: obs.id,
      icon: "observation",
      href: `/observe/${obs.id}`,
      at: obs.observedAt.getTime(),
      timeLabel: formatLogTime(obs.observedAt),
      headlinePrefix: "Observation recorded for ",
      emphasisText: `${obs.yearGroup} ${obs.subject}`,
      plainTitle: null,
      tagLabel: "Academic",
      tagVariant: "academic",
    });
  }

  const significantDrifters = teacherRiskRows
    .filter((r) => r.status === "SIGNIFICANT_DRIFT")
    .slice(0, MAX_DRIFT_LOG_ENTRIES);
  for (const teacher of significantDrifters) {
    logEntries.push({
      id: `drift-${teacher.teacherMembershipId}`,
      icon: "signal",
      href: "/explorer/signals",
      at: computedAt.getTime(),
      timeLabel: formatLogTime(computedAt),
      headlinePrefix: null,
      emphasisText: null,
      plainTitle: `Behaviour drift · ${teacher.teacherName}`,
      tagLabel: "Priority",
      tagVariant: "priority",
    });
  }

  logEntries.sort((a, b) => b.at - a.at);
  const displayedLogs = logEntries.slice(0, MAX_LOG_ENTRIES);

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8">
      <PageHeader variant="ledger"
        eyebrow="Explore"
        title="Explorer"
        subtitle="Drill down beyond Today on home — full pivots, exports, and cross-school views for your analysis window."
        meta={
          <span className="inline-flex flex-wrap items-center gap-2 text-[0.8125rem] leading-snug text-muted">
            <svg className="anx-icon-inline opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
              <rect x="3" y="5" width="18" height="16" rx="2" strokeLinejoin="round" />
              <path strokeLinecap="round" d="M16 3v4M8 3v4M3 11h18" />
            </svg>
            <span>
              {WINDOW_DAYS}d window • Updated {computedAtStr}
            </span>
          </span>
        }
      />

      {/* ── Top Stats Row ──────────────────────────────────────────────────── */}
      <div className={`grid gap-5 sm:grid-cols-2 ${canSeeBehaviour && canSeeAssessment ? "lg:grid-cols-6" : canSeeBehaviour || canSeeAssessment ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
        {/* Teachers */}
        <Link href="/explorer/teachers" className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--primary)_30%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-container-low)]">
          <div className="explorer-hub-kpi-card relative flex h-full flex-col justify-between p-5 calm-transition sm:p-6">
            <div className="flex items-start justify-between gap-2">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-surface-container-low text-muted">
                <IconTeachers />
              </span>
              <span className="rounded-md bg-[var(--pill-error-bg)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--pill-error-text)] ring-1 ring-inset ring-[var(--pill-error-ring)]">
                Real-time
              </span>
            </div>
            <div className="mt-4">
              <p className="explorer-hub-kpi-label">Teachers</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-[2.5rem] font-bold leading-none tracking-[-0.03em] text-[var(--on-surface)] tabular-nums">{totalTeachers}</span>
                <span className="text-sm text-[var(--on-surface-variant)]">tracked</span>
              </div>
            </div>
            <div className="mt-4 border-t border-outline-variant pt-3">
              {driftingTeachers > 0 ? (
                <p className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--error)]">
                  <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--error)]" />
                  {driftingTeachers} drifting educators
                </p>
              ) : (
                <p className="text-[13px] text-[var(--on-surface-variant)]">All educators stable</p>
              )}
            </div>
          </div>
        </Link>

        {/* Departments */}
        <Link href="/explorer/departments" className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--primary)_30%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-container-low)]">
          <div className="explorer-hub-kpi-card relative flex h-full flex-col justify-between p-5 calm-transition sm:p-6">
            <div className="flex items-start justify-between">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-surface-container-low text-muted">
                <IconDepartments />
              </span>
            </div>
            <div className="mt-4">
              <p className="explorer-hub-kpi-label">Departments</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-[2.5rem] font-bold leading-none tracking-[-0.03em] text-[var(--on-surface)] tabular-nums">{totalDepartments}</span>
                <span className="text-sm text-[var(--on-surface-variant)]">depts</span>
              </div>
            </div>
            <div className="mt-4 border-t border-outline-variant pt-3">
              <p className="text-[13px] text-[var(--on-surface-variant)]">{totalObsAcrossDepts} total observations</p>
            </div>
          </div>
        </Link>

        {/* Signals */}
        <Link href="/explorer/signals" className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--primary)_30%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-container-low)]">
          <div className="explorer-hub-kpi-card relative flex h-full flex-col justify-between p-5 calm-transition sm:p-6">
            <div className="flex items-start justify-between">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-surface-container-low text-muted">
                <IconSignals />
              </span>
            </div>
            <div className="mt-4">
              <p className="explorer-hub-kpi-label">Signals</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-[2.5rem] font-bold leading-none tracking-[-0.03em] text-[var(--on-surface)] tabular-nums">{totalSignals}</span>
                <span className="text-sm text-[var(--on-surface-variant)]">tracked</span>
              </div>
            </div>
            <div className="mt-4 border-t border-outline-variant pt-3">
              {highPrioritySignals > 0 ? (
                <p className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--error)]">
                  <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--error)]" />
                  {highPrioritySignals} high priority
                </p>
              ) : (
                <p className="text-[13px] text-[var(--on-surface-variant)]">No high-priority signals</p>
              )}
            </div>
          </div>
        </Link>

        {/* Observations */}
        <Link href="/observe/history" className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--primary)_30%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-container-low)]">
          <div className="explorer-hub-kpi-card relative flex h-full flex-col justify-between p-5 calm-transition sm:p-6">
            <div className="flex items-start justify-between">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-surface-container-low text-muted">
                <IconObservations />
              </span>
            </div>
            <div className="mt-4">
              <p className="explorer-hub-kpi-label">Observations</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-[2.5rem] font-bold leading-none tracking-[-0.03em] text-[var(--on-surface)] tabular-nums">{obsCount}</span>
              </div>
            </div>
            <div className="mt-4 border-t border-outline-variant pt-3">
              <p className="text-[13px] text-[var(--on-surface-variant)]">
                recorded in last <span className="font-semibold text-text">{WINDOW_DAYS}d</span>
              </p>
            </div>
          </div>
        </Link>

        {/* Assessment */}
        {canSeeAssessment && (
          <Link href="/explorer/assessment" className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--primary)_30%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-container-low)]">
            <div className="explorer-hub-kpi-card relative flex h-full flex-col justify-between p-5 calm-transition sm:p-6">
              <div className="flex items-start justify-between">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-surface-container-low text-muted">
                  <IconAssessment />
                </span>
              </div>
              <div className="mt-4">
                <p className="explorer-hub-kpi-label">Assessment</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-[2.5rem] font-bold leading-none tracking-[-0.03em] text-[var(--on-surface)] tabular-nums">{assessmentStudentsTracked}</span>
                  <span className="text-sm text-[var(--on-surface-variant)]">students</span>
                </div>
              </div>
              <div className="mt-4 border-t border-outline-variant pt-3">
                {assessmentValueAddConcerns > 0 ? (
                  <p className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--error)]">
                    <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--error)]" />
                    {assessmentValueAddConcerns} value-add concern{assessmentValueAddConcerns !== 1 ? "s" : ""}
                  </p>
                ) : assessmentSendGap !== null && Math.abs(assessmentSendGap) > 0.08 ? (
                  <p className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--error)]">
                    <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--error)]" />
                    SEND gap {assessmentSendGap > 0 ? "+" : ""}{(assessmentSendGap * 100).toFixed(1)}pp
                  </p>
                ) : (
                  <p className="text-[13px] text-[var(--on-surface-variant)]">No value-add concerns</p>
                )}
              </div>
            </div>
          </Link>
        )}

        {/* Behaviour */}
        {canSeeBehaviour && (
          <Link href="/explorer/analysis" className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--primary)_30%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-container-low)]">
            <div className="explorer-hub-kpi-card relative flex h-full flex-col justify-between p-5 calm-transition sm:p-6">
              <div className="flex items-start justify-between">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-surface-container-low text-muted">
                  <IconBehaviour />
                </span>
              </div>
              <div className="mt-4">
                <p className="explorer-hub-kpi-label">Behaviour</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-[2.5rem] font-bold leading-none tracking-[-0.03em] text-[var(--on-surface)] tabular-nums">{totalStudents}</span>
                  <span className="text-sm text-[var(--on-surface-variant)]">students</span>
                </div>
              </div>
              <div className="mt-4 border-t border-outline-variant pt-3">
                {urgentStudents > 0 ? (
                  <p className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--error)]">
                    <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--error)]" />
                    {urgentStudents} urgent case{urgentStudents !== 1 ? "s" : ""}
                  </p>
                ) : (
                  <p className="text-[13px] text-[var(--on-surface-variant)]">All students stable</p>
                )}
              </div>
            </div>
          </Link>
        )}
      </div>

      {/* ── Priorities (dark ledger band) ─────────────────────────────────── */}
      <div>
        <Link
          href="/analytics"
          className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-container-low)]"
        >
          <div className="explorer-hub-priorities relative overflow-hidden p-6 pr-14 calm-transition sm:p-7 sm:pr-16">
            <svg
              className="pointer-events-none absolute right-4 top-4 h-7 w-7 text-white/50 sm:h-8 sm:w-8"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
              <div className="min-w-0 shrink-0 lg:max-w-[220px]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">Analysis</p>
                <p className="mt-1 text-lg font-bold text-white">Priorities</p>
                <p className="mt-1 text-sm leading-snug text-slate-300">
                  Teacher drift, CPD signals, student bands, and assessment value-add — full detail in analytics.
                </p>
              </div>
              <div
                className={`grid min-w-0 flex-1 gap-4 ${canSeeBehaviour && canSeeAssessment ? "sm:grid-cols-4" : canSeeBehaviour || canSeeAssessment ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}
              >
                <div className="explorer-hub-priorities-column min-w-0 px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">Teachers</p>
                  <ul className="mt-2 space-y-2">
                    {topTeacherPriorities.length === 0 ? (
                      <li className="text-[13px] leading-snug text-slate-300">No drift flags in this window.</li>
                    ) : (
                      topTeacherPriorities.map((row) => (
                        <li key={row.teacherMembershipId} className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-white" title={row.teacherName}>
                            {row.teacherName}
                          </p>
                          <p className="text-[11px] text-slate-400">{teacherStatusShort[row.status]}</p>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
                <div className="explorer-hub-priorities-column min-w-0 px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">CPD signals</p>
                  <ul className="mt-2 space-y-2">
                    {topCpdPriorities.length === 0 ? (
                      <li className="text-[13px] leading-snug text-slate-300">
                        No widespread signal decline in this window.
                      </li>
                    ) : (
                      topCpdPriorities.map((row) => (
                        <li key={row.signalKey} className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-white" title={row.label}>
                            {row.label}
                          </p>
                          <p className="text-[11px] tabular-nums text-slate-400">
                            {Math.round(row.driftRate * 100)}% drifting · {row.teachersCovered} covered
                          </p>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
                {canSeeBehaviour && (
                  <div className="explorer-hub-priorities-column min-w-0 px-3 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">Students</p>
                    <ul className="mt-2 space-y-2">
                      {topStudentPriorities.length === 0 ? (
                        <li className="text-[13px] leading-snug text-slate-300">
                          No urgent or priority band in this window.
                        </li>
                      ) : (
                        topStudentPriorities.map((row) => (
                          <li key={row.studentId} className="min-w-0">
                            <p className="truncate text-[13px] font-medium text-white" title={row.studentName}>
                              {row.studentName}
                            </p>
                            <p className="text-[11px] text-slate-400">{row.band}</p>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                )}
                {canSeeAssessment && (
                  <div className="explorer-hub-priorities-column min-w-0 px-3 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">Assessment</p>
                    <ul className="mt-2 space-y-2">
                      {topAssessmentPriorities.length === 0 ? (
                        <li className="text-[13px] leading-snug text-slate-300">
                          No value-add concerns in this cycle.
                        </li>
                      ) : (
                        topAssessmentPriorities.map((row) => (
                          <li key={`${row.teacherName}-${row.subject}`} className="min-w-0">
                            <p className="truncate text-[13px] font-medium text-white" title={`${row.teacherName} · ${row.subject}`}>
                              {row.subject}
                            </p>
                            <p className="text-[11px] tabular-nums text-slate-400">
                              {row.teacherName} · {row.valueAdd >= 0 ? "+" : ""}{(row.valueAdd * 100).toFixed(1)}pp
                            </p>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Link>
      </div>

      {/* ── Active intelligence log ────────────────────────────────────────── */}
      {displayedLogs.length > 0 && (
        <div className="explorer-hub-intelligence-log mt-10">
          <div className="flex items-center justify-between border-b border-outline-variant px-5 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Active intelligence log</p>
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
              Updated {computedAtStr}
            </span>
          </div>
          <div className="divide-y divide-outline-variant">
            {displayedLogs.map((entry) => (
              <Link
                key={entry.id}
                href={entry.href}
                className="flex min-h-[3.25rem] items-stretch calm-transition hover:bg-surface-container-lowest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color-mix(in_srgb,var(--primary)_20%,transparent)]"
              >
                <div className="flex w-[3.5rem] shrink-0 items-center justify-center border-r border-outline-variant text-xs tabular-nums text-muted">
                  {entry.timeLabel}
                </div>
                <div className="flex min-w-0 flex-1 items-center px-4 py-3">
                  <p className="text-sm text-text">
                    {entry.plainTitle ? (
                      <span className="font-medium">{entry.plainTitle}</span>
                    ) : (
                      <>
                        {entry.headlinePrefix}
                        <span className="font-semibold">{entry.emphasisText}</span>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3 pr-4">
                  <span className="text-xs text-muted">{entry.tagLabel}</span>
                  <svg className="h-4 w-4 shrink-0 text-[#9CA3AF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <p className="mt-10 flex items-center gap-2 text-[0.75rem] text-muted">
        <svg className="h-4 w-4 shrink-0 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 15v4M11 11v8M15 7v12M19 13v6" />
        </svg>
        Explorer · {WINDOW_DAYS}d window · {computedAtStr}
      </p>
    </div>
  );
}
