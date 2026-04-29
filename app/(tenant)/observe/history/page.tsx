import Link from "next/link";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import type { UserRole } from "@/lib/types";
import { prisma } from "@/lib/prisma";
import { getTenantSchoolType } from "@/lib/tenantSchoolType";
import { getSignalDefinitionsForSchoolType } from "@/modules/observations/getSignalsBySchoolType";
import { formatPhaseLabel } from "@/modules/observations/phaseLabel";
import { getTenantSignalLabels } from "@/modules/observations/tenantSignalLabels";
import { formatYearGroup } from "@/modules/observations/yearGroup";
import { pedagogicalSignalTooltip } from "@/modules/observations/signalTooltip";
import { computeObservationHistoryAnalytics } from "@/modules/observations/observationHistoryAnalytics";
import {
  observationFilterDateBounds,
  parseObservationAnalysisPreset,
  resolveObservationAnalysisRangeUnified,
} from "@/modules/observations/observationHistoryAnalysisRange";
import {
  buildObservationHistoryWhere,
  OBSERVATION_HISTORY_PHASE_FILTERS,
} from "@/modules/observations/observationHistoryWhere";
import { Avatar } from "@/components/ui/avatar";
import { PageHeader } from "@/components/ui/page-header";
import { HistoryFilters } from "./HistoryFilters";
import { ObservationHistoryAnalysis } from "./ObservationHistoryAnalysis";

/* ── Signal dot colours by scale level ────────────────────────────────── */
const SIGNAL_DOT_COLOR: Record<string, string> = {
  STRONG:     "bg-[var(--scale-strong-bar)]",
  CONSISTENT: "bg-[var(--scale-consistent-bar)]",
  SOME:       "bg-[var(--scale-some-bar)]",
  LIMITED:    "bg-[var(--scale-limited-bar)]",
};

const PHASE_BADGE: Record<string, string> = {
  INSTRUCTION:           "border-[var(--phase-instruction-text)]/30 text-[var(--phase-instruction-text)]",
  GUIDED_PRACTICE:       "border-[var(--phase-guided-text)]/30 text-[var(--phase-guided-text)]",
  INDEPENDENT_PRACTICE:  "border-[var(--phase-independent-text)]/30 text-[var(--phase-independent-text)]",
  UNKNOWN:               "border-border text-muted",
  THRESHOLD:             "border-[var(--phase-instruction-text)]/30 text-[var(--phase-instruction-text)]",
  TRANSITION_START:      "border-[var(--phase-instruction-text)]/30 text-[var(--phase-instruction-text)]",
  BOOKS:                 "border-border text-muted",
};

/* ── Pagination constants ─────────────────────────────────────────────── */
const PAGE_SIZE = 10;

function formatLongDate(date: Date | string): string {
  const d = new Date(date);
  return `${String(d.getDate()).padStart(2, "0")} ${d.toLocaleDateString("en-GB", { month: "short" })} ${d.getFullYear()}`;
}

export default async function ObservationHistoryPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "OBSERVATIONS");

  const teacherId = String(searchParams?.teacherId || "");
  const subject = String(searchParams?.subject || "").trim();
  const yearGroup = String(searchParams?.yearGroup || "").trim();
  const observerId = String(searchParams?.observerId || "");
  const from = String(searchParams?.from || "");
  const to = String(searchParams?.to || "");
  const phaseRaw = String(searchParams?.phase || "").trim();
  const phaseFilter = OBSERVATION_HISTORY_PHASE_FILTERS.has(phaseRaw) ? phaseRaw : "";
  const signalKeyRaw = String(searchParams?.signalKey || "").trim();
  const schoolType = await getTenantSchoolType(user.tenantId);
  const tenantSignalDefs = getSignalDefinitionsForSchoolType(schoolType);
  const validSignalKeys = new Set(tenantSignalDefs.map((s) => s.key));
  const signalKeyFilter = (validSignalKeys as Set<string>).has(signalKeyRaw) ? signalKeyRaw : "";
  const page = Math.max(1, Number(searchParams?.page || "1"));
  const windowDays = Number(searchParams?.window || "");
  const useWindow = Number.isFinite(windowDays) && windowDays > 0 && !from && !to;
  const windowStart = useWindow ? new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000) : null;
  const analysisPresetRaw = String(searchParams?.analysis || "").trim();
  const analysisPreset = parseObservationAnalysisPreset(analysisPresetRaw) ?? "26w";
  const coachingCoachIdRaw = String(searchParams?.coachingCoach || "").trim();
  const coachingCoacheeIdRaw = String(searchParams?.coachingCoachee || "").trim();

  const [teachers, observers, hodMemberships, coachAssignments, tenantSignalLabels] = await Promise.all([
    (prisma as any).user.findMany({ where: { tenantId: user.tenantId, isActive: true }, orderBy: { fullName: "asc" } }),
    (prisma as any).user.findMany({ where: { tenantId: user.tenantId, isActive: true, role: { in: ["LEADER", "SLT", "ADMIN"] } }, orderBy: { fullName: "asc" } }),
    (prisma as any).departmentMembership.findMany({ where: { userId: user.id, isHeadOfDepartment: true } }),
    (prisma as any).coachAssignment.findMany({ where: { coachUserId: user.id } }),
    getTenantSignalLabels(user.tenantId),
  ]);

  const hodDepartmentIds = (hodMemberships as any[]).map((m: any) => m.departmentId);
  const coacheeUserIds = (coachAssignments as any[]).map((a: any) => a.coacheeUserId);

  const hodDeptMemberships = hodDepartmentIds.length > 0
    ? await (prisma as any).departmentMembership.findMany({
        where: { tenantId: user.tenantId, departmentId: { in: hodDepartmentIds } },
        select: { userId: true },
      })
    : [];

  const hodVisibleUserIds = new Set((hodDeptMemberships as any[]).map((m: any) => m.userId));
  const coachVisibleUserIds = new Set(coacheeUserIds);

  const { where, allowedTeacherIds } = buildObservationHistoryWhere({
    tenantId: user.tenantId,
    userRole: user.role,
    userId: user.id,
    teacherId,
    subject,
    yearGroup,
    observerId,
    from,
    to,
    phaseFilter,
    signalKeyFilter,
    useWindow,
    windowStart,
    hodVisibleUserIds,
    coacheeUserIds,
  });

  const visibleTeachers = allowedTeacherIds
    ? (teachers as any[]).filter((t: any) => (allowedTeacherIds as Set<string>).has(t.id))
    : (teachers as any[]);

  const scopedFilterWhere: any = { tenantId: user.tenantId };
  if (user.role === "TEACHER") scopedFilterWhere.observedTeacherId = user.id;
  else if (allowedTeacherIds) scopedFilterWhere.observedTeacherId = { in: Array.from(allowedTeacherIds) };

  const showPairMatrix = user.role !== "TEACHER";

  const [totalCount, observations, distinctSubjects, obsRowsForAnalysis, tenantCoachAssignments] =
    await Promise.all([
      (prisma as any).observation.count({ where }),
      (prisma as any).observation.findMany({
        where,
        include: { observedTeacher: true, observer: true, signals: true },
        orderBy: { observedAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      (prisma as any).observation.findMany({
        where: scopedFilterWhere,
        distinct: ["subject"],
        select: { subject: true },
        orderBy: { subject: "asc" },
      }),
      (prisma as any).observation.findMany({
        where,
        select: { id: true, observerId: true, observedTeacherId: true, observedAt: true },
      }),
      showPairMatrix && (user.role === "ADMIN" || user.role === "SLT" || user.role === "SUPER_ADMIN")
        ? (prisma as any).coachAssignment.findMany({
            where: { tenantId: user.tenantId },
            include: {
              coach: { select: { fullName: true } },
              coachee: { select: { fullName: true } },
            },
          })
        : Promise.resolve([]),
    ]);

  const observerIds = [
    ...new Set((obsRowsForAnalysis as { observerId: string }[]).map((o) => o.observerId)),
  ];
  const observerUsers =
    observerIds.length === 0
      ? []
      : await (prisma as any).user.findMany({
          where: { id: { in: observerIds } },
          select: { id: true, role: true },
        });
  const roleByObserver = new Map(
    (observerUsers as { id: string; role: UserRole }[]).map((u) => [u.id, u.role]),
  );

  const analyticsObs = (
    obsRowsForAnalysis as { id: string; observerId: string; observedTeacherId: string; observedAt: Date }[]
  ).map((o) => ({
    id: o.id,
    observedTeacherId: o.observedTeacherId,
    observerId: o.observerId,
    observedAt: o.observedAt,
    observerRole: roleByObserver.get(o.observerId) ?? ("TEACHER" as UserRole),
  }));

  let coachAssignmentsForAnalytics: {
    coachUserId: string;
    coacheeUserId: string;
    coachName: string;
    coacheeName: string;
  }[] = [];
  if (user.role === "ADMIN" || user.role === "SLT" || user.role === "SUPER_ADMIN") {
    coachAssignmentsForAnalytics = (tenantCoachAssignments as any[]).map((a: any) => ({
      coachUserId: a.coachUserId,
      coacheeUserId: a.coacheeUserId,
      coachName: a.coach.fullName,
      coacheeName: a.coachee.fullName,
    }));
  } else if (showPairMatrix) {
    coachAssignmentsForAnalytics = (coachAssignments as any[]).map((a: any) => ({
      coachUserId: a.coachUserId,
      coacheeUserId: a.coacheeUserId,
      coachName: user.fullName,
      coacheeName:
        (teachers as any[]).find((t: any) => t.id === a.coacheeUserId)?.fullName ?? "Coachee",
    }));
  }

  const allowedPairCoachIds = new Set(coachAssignmentsForAnalytics.map((a) => a.coachUserId));
  const allowedPairCoacheeIds = new Set(coachAssignmentsForAnalytics.map((a) => a.coacheeUserId));
  const coachingCoachId = allowedPairCoachIds.has(coachingCoachIdRaw) ? coachingCoachIdRaw : "";
  const coachingCoacheeId = allowedPairCoacheeIds.has(coachingCoacheeIdRaw) ? coachingCoacheeIdRaw : "";

  const coachOptionsMap = new Map<string, string>();
  const coacheeOptionsMap = new Map<string, string>();
  for (const a of coachAssignmentsForAnalytics) {
    coachOptionsMap.set(a.coachUserId, a.coachName);
    coacheeOptionsMap.set(a.coacheeUserId, a.coacheeName);
  }
  const coachingCoachFilterOptions = [...coachOptionsMap.entries()]
    .map(([id, fullName]) => ({ id, fullName }))
    .sort((x, y) => x.fullName.localeCompare(y.fullName));
  const coachingCoacheeFilterOptions = [...coacheeOptionsMap.entries()]
    .map(([id, fullName]) => ({ id, fullName }))
    .sort((x, y) => x.fullName.localeCompare(y.fullName));

  let coachAssignmentsForPairTable = coachAssignmentsForAnalytics;
  if (coachingCoachId) {
    coachAssignmentsForPairTable = coachAssignmentsForPairTable.filter((a) => a.coachUserId === coachingCoachId);
  }
  if (coachingCoacheeId) {
    coachAssignmentsForPairTable = coachAssignmentsForPairTable.filter((a) => a.coacheeUserId === coachingCoacheeId);
  }

  const analysisRange = resolveObservationAnalysisRangeUnified({
    analysisPreset,
    from,
    to,
    useWindow,
    windowStart,
  });
  const filterDateBounds = observationFilterDateBounds({ from, to, useWindow, windowStart });
  const analyticsRange =
    analysisRange.emptyIntersection && filterDateBounds
      ? { start: filterDateBounds.start, end: filterDateBounds.end }
      : { start: analysisRange.start, end: analysisRange.end };

  const historyAnalytics = computeObservationHistoryAnalytics({
    observations: analyticsObs,
    range: analyticsRange,
    coachAssignments: coachAssignmentsForPairTable,
    showCoachingSection: showPairMatrix,
  });

  const obsList = observations as any[];
  const totalPages = Math.max(1, Math.ceil((totalCount as number) / PAGE_SIZE));
  const hasFilters =
    !!teacherId ||
    !!subject ||
    !!yearGroup ||
    !!observerId ||
    !!from ||
    !!to ||
    !!phaseFilter ||
    !!signalKeyFilter ||
    useWindow ||
    analysisPreset !== "26w" ||
    !!coachingCoachId ||
    !!coachingCoacheeId;

  const signalFilterOptions = [...tenantSignalDefs]
    .sort((a, b) => a.order - b.order)
    .map((s) => ({
      key: s.key,
      label: tenantSignalLabels[s.key]?.displayName ?? s.displayNameDefault,
    }));

  /* Build URL for a specific page, preserving current filters */
  function pageUrl(p: number): string {
    const params = new URLSearchParams();
    if (teacherId) params.set("teacherId", teacherId);
    if (observerId) params.set("observerId", observerId);
    if (subject) params.set("subject", subject);
    if (yearGroup) params.set("yearGroup", yearGroup);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (phaseFilter) params.set("phase", phaseFilter);
    if (signalKeyFilter) params.set("signalKey", signalKeyFilter);
    if (useWindow) params.set("window", String(windowDays));
    if (analysisPreset !== "26w") params.set("analysis", analysisPreset);
    if (coachingCoachId) params.set("coachingCoach", coachingCoachId);
    if (coachingCoacheeId) params.set("coachingCoachee", coachingCoacheeId);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `/observe/history${qs ? `?${qs}` : ""}`;
  }

  /* Compute visible page numbers (e.g. 1 2 3 ... 10) */
  function getPageNumbers(): (number | "ellipsis")[] {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "ellipsis")[] = [];
    pages.push(1);
    if (page > 3) pages.push("ellipsis");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push("ellipsis");
    pages.push(totalPages);
    return pages;
  }

  const rangeStart = (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, totalCount as number);

  const historyFilterQuery = new URLSearchParams();
  if (teacherId) historyFilterQuery.set("teacherId", teacherId);
  if (observerId) historyFilterQuery.set("observerId", observerId);
  if (subject) historyFilterQuery.set("subject", subject);
  if (yearGroup) historyFilterQuery.set("yearGroup", yearGroup);
  if (from) historyFilterQuery.set("from", from);
  if (to) historyFilterQuery.set("to", to);
  if (phaseFilter) historyFilterQuery.set("phase", phaseFilter);
  if (signalKeyFilter) historyFilterQuery.set("signalKey", signalKeyFilter);
  if (useWindow) historyFilterQuery.set("window", String(windowDays));
  if (analysisPreset !== "26w") historyFilterQuery.set("analysis", analysisPreset);
  if (coachingCoachId) historyFilterQuery.set("coachingCoach", coachingCoachId);
  if (coachingCoacheeId) historyFilterQuery.set("coachingCoachee", coachingCoacheeId);
  const historyFilterQueryString = historyFilterQuery.toString();

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <PageHeader
        title="Observation History"
        subtitle="Secure academic ledger of pedagogical data across all departments."
        actions={
          user.role !== "TEACHER" ? (
            <Link
              href="/observe/new"
              className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-[0.875rem] font-semibold text-on-primary calm-transition anx-card-elevated hover:bg-accentHover"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v2.5h-2.5a.75.75 0 000 1.5h2.5v2.5a.75.75 0 001.5 0v-2.5h2.5a.75.75 0 000-1.5h-2.5v-2.5z" clipRule="evenodd" />
              </svg>
              New Observation
            </Link>
          ) : undefined
        }
      />

      <ObservationHistoryAnalysis
        rangeLabel={analysisRange.label}
        analysisPreset={analysisPreset}
        emptyIntersection={analysisRange.emptyIntersection}
        chartFellBackToTableDates={analysisRange.emptyIntersection && !!filterDateBounds}
        historyFilterQueryString={historyFilterQueryString}
        roleCounts={historyAnalytics.roleCounts}
        pairWeekly={historyAnalytics.pairWeekly}
        timelineWeeks={historyAnalytics.timelineWeeks}
        showCoachingSection={showPairMatrix}
        coachingCoachFilterOptions={coachingCoachFilterOptions}
        coachingCoacheeFilterOptions={coachingCoacheeFilterOptions}
        coachingCoachId={coachingCoachId}
        coachingCoacheeId={coachingCoacheeId}
      />

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <HistoryFilters
        teachers={visibleTeachers.map((t: any) => ({ id: t.id, fullName: t.fullName }))}
        observers={(observers as any[]).map((o: any) => ({ id: o.id, fullName: o.fullName }))}
        subjects={(distinctSubjects as { subject: string }[]).map((r) => r.subject)}
        signalOptions={signalFilterOptions}
        defaults={{ teacherId, observerId, subject, from, to, signalKey: signalKeyFilter }}
        preservedWindowDays={useWindow ? windowDays : null}
        preservedAnalysisPreset={analysisPreset}
        preservedCoachingCoachId={coachingCoachId}
        preservedCoachingCoacheeId={coachingCoacheeId}
        showTeacherFilters={user.role !== "TEACHER"}
        hasFilters={hasFilters}
      />

      {/* ── Results ─────────────────────────────────────────────────────── */}
      {obsList.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
            <svg className="h-6 w-6 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <circle cx="11" cy="11" r="6.5" /><path d="m16.5 16.5 3 3" strokeLinecap="round" />
            </svg>
          </div>
          <p className="text-[0.875rem] font-semibold text-text">No observations found</p>
          <p className="mt-1 text-[0.8125rem] text-muted">Try widening your filters.</p>
        </div>
      ) : (
        <div className="table-shell">
          {/* Desktop table (≥ md) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-head-row text-left">
                  <th className="px-5 py-3.5">Teacher</th>
                  {user.role !== "TEACHER" && <th className="px-4 py-3.5">Observer</th>}
                  <th className="px-4 py-3.5">Subject / Year</th>
                  <th className="px-4 py-3.5">Date</th>
                  <th className="px-4 py-3.5">Phase</th>
                  <th className="px-4 py-3.5">Pedagogical Signals</th>
                </tr>
              </thead>
              <tbody>
                {obsList.map((obs: any) => {
                  const signalValues = (obs.signals as any[]).filter((s: any) => s.valueKey);
                  const phase = obs.phase as string;
                  const phaseBadge = PHASE_BADGE[phase] ?? PHASE_BADGE.UNKNOWN;

                  return (
                    <tr key={obs.id} className="group table-row calm-transition">
                      {/* Teacher */}
                      <td className="px-5 py-4">
                        <Link href={`/observe/${obs.id}`} className="flex items-center gap-3 min-w-0">
                          <Avatar name={obs.observedTeacher?.fullName ?? "?"} size="sm" />
                          <span className="truncate font-semibold text-text group-hover:text-accent calm-transition">
                            {obs.observedTeacher?.fullName ?? "—"}
                          </span>
                        </Link>
                      </td>

                      {/* Observer */}
                      {user.role !== "TEACHER" && (
                        <td className="px-4 py-4 text-muted">
                          {obs.observer?.fullName ?? "—"}
                        </td>
                      )}

                      {/* Subject / Year */}
                      <td className="px-4 py-4">
                        <div className="font-semibold text-text">{obs.subject}</div>
                        <div className="text-[0.75rem] text-muted">{formatYearGroup(obs.yearGroup)}{obs.setGroup ? ` • ${obs.setGroup}` : ""}</div>
                      </td>

                      {/* Date */}
                      <td className="px-4 py-4 tabular-nums text-muted whitespace-nowrap">
                        {formatLongDate(obs.observedAt)}
                      </td>

                      {/* Phase */}
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.04em] ${phaseBadge}`}>
                          {formatPhaseLabel(phase)}
                        </span>
                      </td>

                      {/* Pedagogical Signals */}
                      <td className="px-4 py-4">
                        {signalValues.length === 0 ? (
                          <span className="text-xs text-muted">—</span>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            {signalValues.map((s: any, i: number) => (
                              <span
                                key={i}
                                className={`inline-block h-2.5 w-2.5 cursor-help rounded-full ${SIGNAL_DOT_COLOR[s.valueKey] ?? "bg-border"}`}
                                title={pedagogicalSignalTooltip(s.signalKey, s.valueKey)}
                              />
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile card list (< md) */}
          <div className="md:hidden divide-y divide-border/20">
            {obsList.map((obs: any) => {
              const signalValues = (obs.signals as any[]).filter((s: any) => s.valueKey);
              const phase = obs.phase as string;
              const phaseBadge = PHASE_BADGE[phase] ?? PHASE_BADGE.UNKNOWN;

              return (
                <Link
                  key={obs.id}
                  href={`/observe/${obs.id}`}
                  className="group block px-4 py-3.5 calm-transition hover:bg-accent/[0.04]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={obs.observedTeacher?.fullName ?? "?"} size="sm" />
                        <span className="truncate text-[0.875rem] font-semibold text-text">
                          {obs.observedTeacher?.fullName ?? "—"}
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem] text-muted">
                        <span>{obs.subject} · {formatYearGroup(obs.yearGroup)}</span>
                        <span className="tabular-nums">{formatLongDate(obs.observedAt)}</span>
                        {user.role !== "TEACHER" && obs.observer?.fullName && (
                          <span>by {obs.observer.fullName}</span>
                        )}
                      </div>
                    </div>
                    <svg className="mt-1 h-4 w-4 shrink-0 text-border calm-transition group-hover:text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.04em] ${phaseBadge}`}>
                      {formatPhaseLabel(phase)}
                    </span>
                    {signalValues.length > 0 && (
                      <div className="flex items-center gap-1">
                        {signalValues.map((s: any, i: number) => (
                          <span
                            key={i}
                            className={`inline-block h-2.5 w-2.5 cursor-help rounded-full ${SIGNAL_DOT_COLOR[s.valueKey] ?? "bg-border"}`}
                            title={pedagogicalSignalTooltip(s.signalKey, s.valueKey)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>

          {/* ── Pagination ───────────────────────────────────────────────── */}
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border/20 px-5 py-3.5">
              <p className="text-[0.8125rem] text-muted">
                Showing <span className="font-semibold text-text">{rangeStart}-{rangeEnd}</span> of <span className="font-semibold text-text">{totalCount}</span> observations found
              </p>
              <div className="flex items-center gap-1">
                {/* Prev */}
                {page > 1 ? (
                  <Link href={pageUrl(page - 1)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted calm-transition hover:bg-surface-container-low hover:text-text">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </Link>
                ) : (
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-border">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </span>
                )}
                {/* Pages */}
                {getPageNumbers().map((p, i) =>
                  p === "ellipsis" ? (
                    <span key={`e${i}`} className="inline-flex h-8 w-8 items-center justify-center text-[0.8125rem] text-muted">…</span>
                  ) : p === page ? (
                    <span key={p} className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-[0.8125rem] font-semibold text-on-primary">
                      {p}
                    </span>
                  ) : (
                    <Link key={p} href={pageUrl(p)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[0.8125rem] text-muted calm-transition hover:bg-surface-container-low hover:text-text">
                      {p}
                    </Link>
                  )
                )}
                {/* Next */}
                {page < totalPages ? (
                  <Link href={pageUrl(page + 1)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted calm-transition hover:bg-surface-container-low hover:text-text">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </Link>
                ) : (
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-border">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
