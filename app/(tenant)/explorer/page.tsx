import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import {
  canViewExplorer,
  canViewBehaviourExplorer,
  canViewTeacherAnalysis,
} from "@/modules/authz";
import { computeTeacherRiskIndex } from "@/modules/analysis/teacherRisk";
import { computeDepartmentPivot } from "@/modules/analysis/departmentPivot";
import { computeStudentRiskIndex } from "@/modules/analysis/studentRisk";
import { computeCohortPivot } from "@/modules/analysis/cohortPivot";
import { computeCpdPriorities } from "@/modules/analysis/cpdPriorities";

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

/* Watermark icons for Pastoral Pulse section */
function WatermarkGradCap() {
  return (
    <svg className="absolute right-4 top-1/2 -translate-y-1/2 h-32 w-32 text-black/[0.06]" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z" />
    </svg>
  );
}

function WatermarkDiamond() {
  return (
    <svg className="absolute right-4 top-1/2 -translate-y-1/2 h-28 w-28 text-black/[0.06]" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2L2 12l10 10 10-10L12 2zm0 2.83L19.17 12 12 19.17 4.83 12 12 4.83z" />
      <path d="M12 6.34L6.34 12 12 17.66 17.66 12 12 6.34z" />
    </svg>
  );
}

function WatermarkChartBars() {
  return (
    <svg className="absolute right-4 top-1/2 -translate-y-1/2 h-28 w-28 text-black/[0.06]" fill="currentColor" viewBox="0 0 24 24">
      <path d="M4 19h3v-8H4v8zm5 0h3V5H9v14zm5 0h3v-5h-3v5z" />
    </svg>
  );
}

/* ─── Time-ago helper ──────────────────────────────────────────────────────── */
function timeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} mins ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/* ─── Page ─────────────────────────────────────────────────────────────────── */

export default async function ExplorerPage() {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ANALYSIS");

  // Build viewer context
  const [hodMemberships, coachAssignments] = await Promise.all([
    (prisma as any).departmentMembership.findMany({
      where: { userId: user.id, isHeadOfDepartment: true },
    }),
    (prisma as any).coachAssignment.findMany({ where: { coachUserId: user.id } }),
  ]);

  const hodDepartmentIds = (hodMemberships as any[]).map((m: any) => m.departmentId);
  const coacheeUserIds = (coachAssignments as any[]).map((a: any) => a.coacheeUserId);
  const viewerContext = { userId: user.id, role: user.role, hodDepartmentIds, coacheeUserIds };

  if (!canViewExplorer(viewerContext)) notFound();
  const canSeeBehaviour = canViewBehaviourExplorer(viewerContext);

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
    ...behaviourResults
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
    ...(canSeeBehaviour
      ? [
          computeStudentRiskIndex(user.tenantId, WINDOW_DAYS, user.id),
          computeCohortPivot(user.tenantId, WINDOW_DAYS),
        ]
      : []),
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
  let safeStudents = 0;
  let totalStudents = 0;
  let yearGroupCount = 0;
  let academicLoadPct = 0;

  if (canSeeBehaviour && behaviourResults.length === 2) {
    const studentResult = behaviourResults[0] as Awaited<ReturnType<typeof computeStudentRiskIndex>>;
    const cohortResult = behaviourResults[1] as Awaited<ReturnType<typeof computeCohortPivot>>;

    urgentStudents = studentResult.rows.filter(
      (r) => r.band === "PRIORITY" || r.band === "URGENT",
    ).length;
    totalStudents = studentResult.rows.length;
    safeStudents = totalStudents - urgentStudents;
    yearGroupCount = cohortResult.rows.length;

    // Compute academic load as average attendance across cohorts
    const attendanceValues = cohortResult.rows
      .map((r) => r.attendanceMean)
      .filter((v): v is number => v !== null);
    academicLoadPct = attendanceValues.length > 0
      ? Math.round(attendanceValues.reduce((a, b) => a + b, 0) / attendanceValues.length)
      : 0;
  }

  let topStudentPriorities: { studentId: string; studentName: string; band: string }[] = [];
  if (canSeeBehaviour && behaviourResults.length >= 1) {
    const studentResult = behaviourResults[0] as Awaited<ReturnType<typeof computeStudentRiskIndex>>;
    topStudentPriorities = studentResult.rows
      .filter((r) => r.band === "PRIORITY" || r.band === "URGENT")
      .slice(0, 3)
      .map((r) => ({
        studentId: r.studentId,
        studentName: r.studentName,
        band: r.band === "URGENT" ? "Urgent" : "Priority",
      }));
  }

  // ─── Build intelligence log entries ─────────────────────────────────────────
  type LogEntry = {
    id: string;
    icon: "observation" | "signal";
    title: string;
    meta: string;
    tag: string;
    tagVariant: "academic" | "priority";
  };

  const logEntries: LogEntry[] = [];

  // Add recent observations
  for (const obs of recentObservations) {
    logEntries.push({
      id: obs.id,
      icon: "observation",
      title: `Observation recorded for ${obs.yearGroup} ${obs.subject}`,
      meta: `${obs.observer.fullName} · ${timeAgo(obs.observedAt)}`,
      tag: "ACADEMIC",
      tagVariant: "academic",
    });
  }

  // Add behaviour drift signals from drifting teachers
  const significantDrifters = teacherRiskRows
    .filter((r) => r.status === "SIGNIFICANT_DRIFT")
    .slice(0, MAX_DRIFT_LOG_ENTRIES);
  for (const teacher of significantDrifters) {
    logEntries.push({
      id: `drift-${teacher.teacherName}`,
      icon: "signal",
      title: `Behaviour drift signal triggered`,
      meta: `${teacher.departmentNames?.[0] ?? "Unknown dept"}: ${teacher.teacherName} · significant drift`,
      tag: "PRIORITY",
      tagVariant: "priority",
    });
  }

  // Sort by most recent observation first, then signals
  const displayedLogs = logEntries.slice(0, MAX_LOG_ENTRIES);

  const computedAt = deptResult.computedAt;
  const computedAtStr = computedAt.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8">
      <PageHeader variant="ledger"
        eyebrow="Analysis"
        title="Explorer"
        subtitle="Command centre for teachers, departments, signals, and behaviour — tuned to a rolling observation window."
        meta={
          <span className="inline-flex flex-wrap items-center gap-2 text-[0.8125rem] leading-snug text-muted">
            <svg className="anx-icon-inline opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
              <rect x="3" y="5" width="18" height="16" rx="2" strokeLinejoin="round" />
              <path strokeLinecap="round" d="M16 3v4M8 3v4M3 11h18" />
            </svg>
            <span>
              {WINDOW_DAYS}d window · Updated {computedAtStr}
            </span>
          </span>
        }
      />

      {/* ── Top Stats Row ──────────────────────────────────────────────────── */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Teachers */}
        <Link href="/explorer/teachers" className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--primary)_30%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-container-low)]">
          <div className="explorer-kpi-tile explorer-kpi-hover relative flex h-full flex-col justify-between p-5 calm-transition sm:p-6">
            <div className="flex items-start justify-between gap-2">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-[color-mix(in_srgb,var(--surface-container)_70%,transparent)] text-[var(--on-surface-variant)] ring-1 ring-[color-mix(in_srgb,var(--outline-variant)_12%,transparent)]">
                <IconTeachers />
              </span>
              <span className="rounded-md bg-[var(--pill-error-bg)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--pill-error-text)] ring-1 ring-inset ring-[var(--pill-error-ring)]">
                Real-time
              </span>
            </div>
            <div className="mt-4">
              <p className="text-sm font-semibold text-[var(--on-surface)]">Teachers</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-[2.5rem] font-bold leading-none tracking-[-0.03em] text-[var(--on-surface)] tabular-nums">{totalTeachers}</span>
                <span className="text-sm text-[var(--on-surface-variant)]">tracked</span>
              </div>
            </div>
            <div className="mt-4 border-t border-[color-mix(in_srgb,var(--outline-variant)_25%,transparent)] pt-3">
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
          <div className="explorer-kpi-tile explorer-kpi-hover relative flex h-full flex-col justify-between p-5 calm-transition sm:p-6">
            <div className="flex items-start justify-between">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-[color-mix(in_srgb,var(--surface-container)_70%,transparent)] text-[var(--on-surface-variant)] ring-1 ring-[color-mix(in_srgb,var(--outline-variant)_12%,transparent)]">
                <IconDepartments />
              </span>
            </div>
            <div className="mt-4">
              <p className="text-sm font-semibold text-[var(--on-surface)]">Departments</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-[2.5rem] font-bold leading-none tracking-[-0.03em] text-[var(--on-surface)] tabular-nums">{totalDepartments}</span>
                <span className="text-sm text-[var(--on-surface-variant)]">depts</span>
              </div>
            </div>
            <div className="mt-4 border-t border-[color-mix(in_srgb,var(--outline-variant)_25%,transparent)] pt-3">
              <p className="text-[13px] text-[var(--on-surface-variant)]">{totalObsAcrossDepts} total observations</p>
            </div>
          </div>
        </Link>

        {/* Signals */}
        <Link href="/explorer/signals" className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--primary)_30%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-container-low)]">
          <div className="explorer-kpi-tile explorer-kpi-hover relative flex h-full flex-col justify-between p-5 calm-transition sm:p-6">
            <div className="flex items-start justify-between">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-[color-mix(in_srgb,var(--surface-container)_70%,transparent)] text-[var(--on-surface-variant)] ring-1 ring-[color-mix(in_srgb,var(--outline-variant)_12%,transparent)]">
                <IconSignals />
              </span>
            </div>
            <div className="mt-4">
              <p className="text-sm font-semibold text-[var(--on-surface)]">Signals</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-[2.5rem] font-bold leading-none tracking-[-0.03em] text-[var(--on-surface)] tabular-nums">{totalSignals}</span>
                <span className="text-sm text-[var(--on-surface-variant)]">tracked</span>
              </div>
            </div>
            <div className="mt-4 border-t border-[color-mix(in_srgb,var(--outline-variant)_25%,transparent)] pt-3">
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
          <div className="explorer-kpi-tile explorer-kpi-hover relative flex h-full flex-col justify-between p-5 calm-transition sm:p-6">
            <div className="flex items-start justify-between">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-[color-mix(in_srgb,var(--surface-container)_70%,transparent)] text-[var(--on-surface-variant)] ring-1 ring-[color-mix(in_srgb,var(--outline-variant)_12%,transparent)]">
                <IconObservations />
              </span>
            </div>
            <div className="mt-4">
              <p className="text-sm font-semibold text-[var(--on-surface)]">Observations</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-[2.5rem] font-bold leading-none tracking-[-0.03em] text-[var(--on-surface)] tabular-nums">{obsCount}</span>
              </div>
            </div>
            <div className="mt-4 border-t border-[color-mix(in_srgb,var(--outline-variant)_25%,transparent)] pt-3">
              <p className="text-[13px] text-[var(--on-surface-variant)]">
                recorded in last <span className="font-semibold text-text">{WINDOW_DAYS}d</span>
              </p>
            </div>
          </div>
        </Link>
      </div>

      {/* ── Priorities Card ────────────────────────────────────────────────── */}
      <div>
        <Link href="/analytics" className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-container-low)]">
          <div className="home-cpd-hero relative overflow-hidden p-6 pr-14 text-on-primary calm-transition group-hover:opacity-[0.97] sm:p-7 sm:pr-16">
            <svg
              className="pointer-events-none absolute right-4 top-4 h-7 w-7 opacity-60 sm:h-8 sm:w-8"
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
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] opacity-80">Analysis</p>
                <p className="mt-1 text-lg font-bold">Priorities</p>
                <p className="mt-1 text-sm opacity-90">
                  Teacher drift, CPD signal focus, and student bands — full detail in Analytics.
                </p>
              </div>
              <div
                className={`grid min-w-0 flex-1 gap-4 ${canSeeBehaviour ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}
              >
                <div className="min-w-0 rounded-xl border border-white/15 bg-white/10 px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] opacity-90">Teachers</p>
                  <ul className="mt-2 space-y-2">
                    {topTeacherPriorities.length === 0 ? (
                      <li className="text-[13px] leading-snug opacity-90">No drift flags in this window.</li>
                    ) : (
                      topTeacherPriorities.map((row) => (
                        <li key={row.teacherMembershipId} className="min-w-0">
                          <p className="truncate text-[13px] font-medium" title={row.teacherName}>
                            {row.teacherName}
                          </p>
                          <p className="text-[11px] opacity-80">{teacherStatusShort[row.status]}</p>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
                <div className="min-w-0 rounded-xl border border-white/15 bg-white/10 px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] opacity-90">CPD signals</p>
                  <ul className="mt-2 space-y-2">
                    {topCpdPriorities.length === 0 ? (
                      <li className="text-[13px] leading-snug opacity-90">
                        No widespread signal decline in this window.
                      </li>
                    ) : (
                      topCpdPriorities.map((row) => (
                        <li key={row.signalKey} className="min-w-0">
                          <p className="truncate text-[13px] font-medium" title={row.label}>
                            {row.label}
                          </p>
                          <p className="text-[11px] tabular-nums opacity-80">
                            {Math.round(row.driftRate * 100)}% drifting · {row.teachersCovered} covered
                          </p>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
                {canSeeBehaviour && (
                  <div className="min-w-0 rounded-xl border border-white/15 bg-white/10 px-3 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] opacity-90">Students</p>
                    <ul className="mt-2 space-y-2">
                      {topStudentPriorities.length === 0 ? (
                        <li className="text-[13px] leading-snug opacity-90">
                          No urgent or priority band in this window.
                        </li>
                      ) : (
                        topStudentPriorities.map((row) => (
                          <li key={row.studentId} className="min-w-0">
                            <p className="truncate text-[13px] font-medium" title={row.studentName}>
                              {row.studentName}
                            </p>
                            <p className="text-[11px] opacity-80">{row.band}</p>
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

      {/* ── Pastoral Pulse: Behaviour & Welfare ────────────────────────────── */}
      {canSeeBehaviour && (
        <div className="mt-12">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--on-surface-variant)]">
            Pastoral Pulse
          </p>
          <h2 className="mt-1 text-pretty text-[clamp(1.5rem,3vw,1.75rem)] font-bold leading-tight tracking-[-0.03em] text-[var(--on-surface)]">
            Behaviour &amp; Welfare
          </h2>

          <div className="mt-6 grid grid-cols-1 items-stretch gap-5 md:grid-cols-3">
            {/* Students Card */}
            <Link href="/explorer/students" className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--primary)_30%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-container-low)]">
              <div className="explorer-kpi-tile explorer-kpi-hover relative h-full overflow-hidden p-6 calm-transition sm:p-7">
                <WatermarkGradCap />
                <p className="text-lg font-semibold text-[var(--on-surface)]">Students</p>
                <div className="mt-3 flex items-baseline gap-3">
                  <span className="text-[4.5rem] font-bold leading-none tracking-tight text-[var(--on-surface)]">
                    {totalStudents}
                  </span>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--on-surface)]">Total Active</p>
                    <p className="text-[11px] text-[var(--on-surface-variant)]">Managed Enrollment</p>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <div className="rounded-xl border border-[color-mix(in_srgb,var(--error)_18%,transparent)] bg-[color-mix(in_srgb,var(--pill-error-bg)_45%,var(--surface-container-lowest))] px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--pill-error-text)]">Urgent Action</p>
                    <div className="mt-1 flex items-baseline gap-1.5">
                      <span className="text-xl font-bold tabular-nums text-[var(--on-surface)]">{urgentStudents}</span>
                      <span className="text-xs text-[var(--on-surface-variant)]">students</span>
                    </div>
                  </div>
                  <div className="rounded-xl border border-[color-mix(in_srgb,var(--success)_20%,transparent)] bg-[color-mix(in_srgb,var(--pill-success-bg)_55%,var(--surface-container-lowest))] px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--pill-success-text)]">Safe State</p>
                    <div className="mt-1 flex items-baseline gap-1.5">
                      <span className="text-xl font-bold tabular-nums text-[var(--on-surface)]">{safeStudents}</span>
                      <span className="text-xs text-[var(--on-surface-variant)]">students</span>
                    </div>
                  </div>
                </div>
              </div>
            </Link>

            {/* Cohorts Card */}
            <Link href="/explorer/cohorts" className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--primary)_30%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-container-low)]">
              <div className="explorer-kpi-tile explorer-kpi-hover relative h-full overflow-hidden p-6 calm-transition sm:p-7">
                <WatermarkDiamond />
                <p className="text-lg font-semibold text-[var(--on-surface)]">Cohorts</p>
                <div className="mt-3 flex items-baseline gap-3">
                  <span className="text-[4.5rem] font-bold leading-none tracking-tight text-[var(--on-surface)]">
                    {yearGroupCount}
                  </span>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--on-surface)]">Year Groups</p>
                    <p className="text-[11px] text-[var(--on-surface-variant)]">Institutional Structure</p>
                  </div>
                </div>
                <div className="mt-8">
                  <div className="h-2 w-full overflow-hidden rounded-sm bg-[color-mix(in_srgb,var(--surface-container-high)_90%,transparent)]">
                    <div
                      className="home-stat-bar-fill h-full rounded-sm bg-[var(--on-surface)]"
                      style={{ width: `${academicLoadPct}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--on-surface-variant)]">Academic Load</p>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--on-surface-variant)]">{academicLoadPct}% Capacity</p>
                  </div>
                </div>
              </div>
            </Link>

            {/* Behaviour Analysis Card */}
            <Link href="/explorer/analysis" className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--primary)_30%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-container-low)]">
              <div className="explorer-kpi-tile explorer-kpi-hover relative h-full overflow-hidden p-6 calm-transition sm:p-7">
                <WatermarkChartBars />
                <p className="text-lg font-semibold text-[var(--on-surface)]">Behaviour Analysis</p>
                <div className="mt-3 flex items-baseline gap-3">
                  <span className="text-[4.5rem] font-bold leading-none tracking-tight text-[var(--on-surface)]">
                    {urgentStudents}
                  </span>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--on-surface)]">Urgent Priority</p>
                    <p className="text-[11px] text-[var(--on-surface-variant)]">Urgent &amp; priority bands</p>
                  </div>
                </div>
                <div className="mt-8">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--on-surface-variant)]">Assessment window</p>
                  <p className="mt-1 text-xs text-[var(--on-surface-variant)]">Pastoral bands over the last {WINDOW_DAYS} days</p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      )}

      {/* ── Active Intelligence Log ────────────────────────────────────────── */}
      {displayedLogs.length > 0 && (
        <div className="mt-12">
          <div className="flex items-center justify-between rounded-t-2xl bg-[var(--surface-container)] px-6 py-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--on-surface-variant)]">
              Active Intelligence Log
            </p>
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-[var(--success)]" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--on-surface-variant)]">Live Syncing</span>
            </div>
          </div>
          <div className="divide-y divide-[var(--surface-container)] overflow-hidden rounded-b-2xl bg-[var(--surface-container-lowest)] shadow-ambient">
            {displayedLogs.map((entry) => (
              <Link
                key={entry.id}
                href={entry.icon === "observation" ? `/observe/${entry.id}` : `/explorer/signals`}
                className="flex items-center gap-4 px-6 py-4 calm-transition hover:bg-[var(--surface-container-low)]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--surface-container-low)] text-[var(--on-surface-variant)]">
                  {entry.icon === "observation" ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                    </svg>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--on-surface)]">{entry.title}</p>
                  <p className="mt-0.5 text-[12px] text-[var(--on-surface-variant)]">{entry.meta}</p>
                </div>
                <span
                  className={`shrink-0 rounded-md px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] ${
                    entry.tagVariant === "priority"
                      ? "bg-[var(--tertiary-container)] text-[var(--on-tertiary-container)]"
                      : "border border-[var(--outline-variant)] text-[var(--on-surface-variant)]"
                  }`}
                >
                  {entry.tag}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <p className="mt-10 text-[0.75rem] text-muted">
        Explorer · {WINDOW_DAYS}d window · {computedAtStr}
      </p>
    </div>
  );
}
