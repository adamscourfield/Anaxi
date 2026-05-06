import Link from "next/link";
import { ClickableRow } from "@/components/ui/clickable-row";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { notFound } from "next/navigation";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { canViewExplorer, canExportExplorer } from "@/modules/authz";
import {
  computeCpdPriorities,
  getTopImprovingSignals,
  computeWeeklyDriftTrend,
} from "@/modules/analysis/cpdPriorities";
import type { CpdPriorityRow } from "@/modules/analysis/cpdPriorities";
import { getSignalDefinitionsForSchoolType } from "@/modules/observations/getSignalsBySchoolType";
import { formatPhaseLabel } from "@/modules/observations/phaseLabel";
import {
  CLASSROOM_LESSON_PHASES_PRIMARY,
  CLASSROOM_LESSON_PHASES_SECONDARY,
  LESSON_PHASE,
  type LessonPhase,
  type SignalKey,
} from "@/modules/observations/signalTypes";

const VALID_WINDOWS = [7, 21, 28, 90] as const;
type WindowDays = (typeof VALID_WINDOWS)[number];

const PRIORITY_LEVELS = ["HIGH", "MEDIUM", "LOW"] as const;
type PriorityLevel = (typeof PRIORITY_LEVELS)[number];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function phaseGroupsForSchoolType(schoolType: "PRIMARY" | "SECONDARY"): LessonPhase[] {
  return schoolType === "PRIMARY"
    ? [...CLASSROOM_LESSON_PHASES_PRIMARY]
    : [...CLASSROOM_LESSON_PHASES_SECONDARY];
}

function parseWindow(raw: string | undefined): WindowDays {
  const n = Number(raw);
  return VALID_WINDOWS.includes(n as WindowDays) ? (n as WindowDays) : 21;
}

function parseSignalKey(
  raw: string | undefined,
  valid: Set<SignalKey>,
): SignalKey | undefined {
  if (!raw || !valid.has(raw as SignalKey)) return undefined;
  return raw as SignalKey;
}

function parsePriorityLevel(raw: string | undefined): PriorityLevel | undefined {
  if (!raw) return undefined;
  return PRIORITY_LEVELS.includes(raw as PriorityLevel)
    ? (raw as PriorityLevel)
    : undefined;
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function getPriorityLevel(row: CpdPriorityRow): "HIGH" | "MEDIUM" | "LOW" {
  if (row.driftRate > 0.2) return "HIGH";
  if (row.driftRate > 0.1) return "MEDIUM";
  return "LOW";
}

function getPriorityStripeClass(level: "HIGH" | "MEDIUM" | "LOW") {
  if (level === "HIGH") return "border-l-[3px] border-l-[#EF4444]";
  if (level === "MEDIUM") return "border-l-[3px] border-l-[#F59E0B]";
  return "border-l-[3px] border-l-[color-mix(in_srgb,var(--outline-variant)_55%,transparent)]";
}

function getPriorityPillClass(level: "HIGH" | "MEDIUM" | "LOW") {
  if (level === "HIGH")
    return "bg-[color-mix(in_srgb,#EF4444_12%,transparent)] text-[#B91C1C]";
  if (level === "MEDIUM")
    return "bg-[color-mix(in_srgb,#F59E0B_14%,transparent)] text-[#C2410C]";
  return "bg-surface-container-low text-muted";
}

function getImprovementLabel(index: number): { label: string; pillClass: string } {
  if (index >= 85)
    return { label: "Excellent", pillClass: "bg-emerald-50 text-emerald-700" };
  if (index >= 70)
    return { label: "Good", pillClass: "bg-emerald-50 text-emerald-700" };
  if (index >= 50)
    return { label: "Fair", pillClass: "bg-amber-50 text-amber-800" };
  return { label: "Needs Work", pillClass: "bg-red-50 text-red-700" };
}

function getDriftBarColor(rate: number): string {
  if (rate > 0.2) return "bg-[#F87171]";
  return "bg-[#111827]";
}

function InfoHint({ label }: { label: string }) {
  return (
    <span
      className="inline-flex shrink-0 text-[#6B7280]"
      title={label}
      aria-label={label}
    >
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <circle cx="12" cy="12" r="10" />
        <path strokeLinecap="round" d="M12 16v-4M12 8h.01" />
      </svg>
    </span>
  );
}

export default async function SignalsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ANALYSIS");

  const settings = await (prisma as any).tenantSettings.findUnique({ where: { tenantId: user.tenantId } });
  const schoolType = (settings?.schoolType ?? "SECONDARY") as "PRIMARY" | "SECONDARY";
  const tenantSignalDefs = getSignalDefinitionsForSchoolType(schoolType);
  const validSignalKeys = new Set<SignalKey>(tenantSignalDefs.map((s) => s.key));
  const phaseGroupsForFilter = phaseGroupsForSchoolType(schoolType);
  const universalClassroomSignals = tenantSignalDefs.filter((s) => s.isUniversal);

  const [hodMemberships, coachAssignments] = await Promise.all([
    (prisma as any).departmentMembership.findMany({
      where: { userId: user.id, isHeadOfDepartment: true },
    }),
    (prisma as any).coachAssignment.findMany({
      where: { coachUserId: user.id },
    }),
  ]);

  const hodDepartmentIds = (hodMemberships as any[]).map(
    (m: any) => m.departmentId,
  );
  const coacheeUserIds = (coachAssignments as any[]).map(
    (a: any) => a.coacheeUserId,
  );
  const viewerContext = {
    userId: user.id,
    role: user.role,
    hodDepartmentIds,
    coacheeUserIds,
  };

  if (!canViewExplorer(viewerContext)) return notFound();

  const windowDays = parseWindow(
    Array.isArray(params.windowDays)
      ? params.windowDays[0]
      : params.windowDays,
  );
  const rawDeptId = Array.isArray(params.departmentId)
    ? params.departmentId[0]
    : params.departmentId;

  const isHod = user.role === "HOD";

  const departmentId =
    rawDeptId && (!isHod || hodDepartmentIds.includes(rawDeptId))
      ? rawDeptId
      : undefined;

  const rawSignalKey = Array.isArray(params.signalKey)
    ? params.signalKey[0]
    : params.signalKey;
  const rawPriority = Array.isArray(params.priority)
    ? params.priority[0]
    : params.priority;
  const signalKeyFilter = parseSignalKey(rawSignalKey, validSignalKeys);
  const priorityFilter = parsePriorityLevel(rawPriority);

  const filters = departmentId ? { departmentId } : undefined;

  const previousWindowEnd = new Date(Date.now() - windowDays * MS_PER_DAY);

  const [rows, prevPeriodRows, departments, driftTrend] = await Promise.all([
    computeCpdPriorities(user.tenantId, windowDays, filters),
    computeCpdPriorities(user.tenantId, windowDays, filters, {
      referenceEnd: previousWindowEnd,
    }),
    (prisma as any).department.findMany({
      where: { tenantId: user.tenantId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    computeWeeklyDriftTrend(user.tenantId, filters),
  ]);

  const filteredRows = rows.filter((r) => {
    if (signalKeyFilter && r.signalKey !== signalKeyFilter) return false;
    if (priorityFilter && getPriorityLevel(r) !== priorityFilter) return false;
    return true;
  });
  const filteredPrevRows = prevPeriodRows.filter((r) => {
    if (signalKeyFilter && r.signalKey !== signalKeyFilter) return false;
    if (priorityFilter && getPriorityLevel(r) !== priorityFilter) return false;
    return true;
  });

  const improving = getTopImprovingSignals(filteredRows);
  const sortedRows = [...filteredRows].sort(
    (a, b) => b.priorityScore - a.priorityScore,
  );

  const selectableDepts = isHod
    ? (departments as any[]).filter((d: any) =>
        hodDepartmentIds.includes(d.id),
      )
    : (departments as any[]);

  const showExport = canExportExplorer(viewerContext);

  const totalSignals = filteredRows.reduce((s, r) => s + r.teachersCovered, 0);
  const prevTotalSignals = filteredPrevRows.reduce((s, r) => s + r.teachersCovered, 0);
  const totalDrifting = filteredRows.reduce((s, r) => s + r.teachersDriftingDown, 0);
  const totalImproving = filteredRows.reduce((s, r) => s + r.teachersImproving, 0);
  const avgDriftRate = totalSignals > 0 ? totalDrifting / totalSignals : 0;
  const improvementIndex = totalSignals > 0 ? (1 - avgDriftRate) * 100 : 0;
  const improvementMeta = getImprovementLabel(improvementIndex);

  let totalSignalsTrendPct = 0;
  if (prevTotalSignals > 0) {
    totalSignalsTrendPct = Math.round(
      ((totalSignals - prevTotalSignals) / prevTotalSignals) * 100,
    );
  } else if (totalSignals > 0) {
    totalSignalsTrendPct = 100;
  }

  const maxDriftRate = Math.max(...sortedRows.map((r) => r.driftRate), 0.01);
  const maxBarHeight = Math.max(...driftTrend.days.map((d) => d.observationCount), 1);
  const moreFiltersActive = Boolean(signalKeyFilter || priorityFilter);

  function buildUrl(overrides: Record<string, string | undefined>) {
    const merged: Record<string, string> = {
      windowDays: String(windowDays),
      ...(departmentId ? { departmentId } : {}),
      ...(signalKeyFilter ? { signalKey: signalKeyFilter } : {}),
      ...(priorityFilter ? { priority: priorityFilter } : {}),
      ...Object.fromEntries(
        Object.entries(overrides).filter(
          (e): e is [string, string] => e[1] !== undefined,
        ),
      ),
    };
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined) delete merged[k];
    }
    const qs = new URLSearchParams(merged).toString();
    return `/explorer/signals${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="-mx-4 -mt-4 min-h-[calc(100vh-4rem)] bg-[#F9FAFB] px-4 pb-12 pt-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="mx-auto max-w-[1400px] space-y-8">
        <div className="mb-2">
          <Link
            href="/explorer"
            className="inline-flex items-center gap-1 text-[0.8125rem] font-medium text-[#6B7280] transition-colors hover:text-[#111827]"
          >
            <span aria-hidden className="text-[0.9375rem] leading-none">
              &lt;
            </span>
            Back to Explorer
          </Link>
        </div>

        <PageHeader
          variant="ledger"
          className="!mb-8 border-0 !pb-0"
          eyebrowClassName="text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-[#6B7280]"
          eyebrow="Explorer"
          titleClassName="text-[1.75rem] font-bold tracking-tight text-[#111827] md:text-[2rem]"
          subtitleClassName="text-[0.875rem] font-medium leading-relaxed text-[#6B7280]"
          title="Signals"
          subtitle="Instructional signals and drift — filter by department and time window."
        />

        <div className="rounded-xl border border-[color-mix(in_srgb,#E5E7EB_90%,transparent)] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] md:p-6">
          <div className="flex w-full flex-col gap-5 lg:flex-row lg:flex-wrap lg:items-end lg:gap-x-6 lg:gap-y-4">
            <div className="flex min-w-0 flex-col gap-2 lg:flex-none">
              <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">
                Time window
              </span>
              <div className="filter-period-toggle w-fit max-w-full bg-[#F3F4F6]">
                {VALID_WINDOWS.map((w) => (
                  <Link
                    key={w}
                    href={buildUrl({ windowDays: String(w) })}
                    className={`filter-period-btn ${w === windowDays ? "filter-period-btn-active" : ""}`}
                  >
                    {w}D
                  </Link>
                ))}
              </div>
            </div>

            <form
              id="signals-explorer-filters"
              method="get"
              action="/explorer/signals"
              className="flex min-w-0 flex-1 flex-col gap-2 lg:min-w-[220px] lg:max-w-[min(100%,320px)]"
            >
              <input type="hidden" name="windowDays" value={String(windowDays)} />
              <label className="flex flex-col gap-2">
                <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">
                  Department
                </span>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" aria-hidden>
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                    </svg>
                  </span>
                  <select
                    name="departmentId"
                    defaultValue={rawDeptId ?? ""}
                    className="field field-filter-trigger !w-full !rounded-[10px] !border-[#E5E7EB] !bg-white !py-2.5 !pl-10 !pr-3 !text-[0.8125rem] text-[#111827]"
                  >
                    <option value="">All Departments</option>
                    {selectableDepts.map((d: any) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </label>
            </form>

            <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:ml-auto lg:w-auto lg:flex-none">
              <button
                type="submit"
                form="signals-explorer-filters"
                className="inline-flex h-10 min-w-0 items-center justify-center gap-2 rounded-[10px] bg-[#111827] px-4 text-[0.8125rem] font-semibold text-white shadow-sm transition-opacity hover:opacity-90 sm:min-w-[148px]"
              >
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v5.45a8.11 8.11 0 0 1-3.05 6.325l-.257.19-6.206 4.63a.75.75 0 0 1-.895 0l-6.207-4.63a8.11 8.11 0 0 1-3.048-6.327v-5.451c0-.54.384-1.006.917-1.097A32.08 32.08 0 0 1 12 3Z" />
                </svg>
                Apply Filters
              </button>
              <details className="group relative w-full sm:w-auto" open={moreFiltersActive}>
                <summary className="flex h-10 w-full cursor-pointer list-none items-center justify-center gap-2 rounded-[10px] border border-[#E5E7EB] bg-white px-4 text-[0.8125rem] font-medium text-[#374151] shadow-sm marker:hidden hover:bg-[#F9FAFB] sm:min-w-[140px] [&::-webkit-details-marker]:hidden">
                  <svg className="h-4 w-4 shrink-0 text-[#6B7280]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
                  </svg>
                  More Filters
                </summary>
                <div className="absolute left-0 right-0 z-20 mt-2 rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-lg sm:left-auto sm:right-auto sm:min-w-[280px]">
                  <p className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">
                    Refine table
                  </p>
                  <div className="flex flex-col gap-3">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">
                        Signal
                      </span>
                      <select
                        form="signals-explorer-filters"
                        name="signalKey"
                        defaultValue={signalKeyFilter ?? ""}
                        className="field field-filter-trigger !rounded-[10px] !border-[#E5E7EB] !py-2.5 !text-[0.8125rem]"
                      >
                        <option value="">All signals</option>
                        <optgroup label="Universal (classroom)">
                          {universalClassroomSignals.map((s) => (
                            <option key={s.key} value={s.key}>
                              {s.displayNameDefault}
                            </option>
                          ))}
                        </optgroup>
                        {phaseGroupsForFilter.map((phase) => {
                          const phaseSignals = tenantSignalDefs.filter(
                            (s) => !s.isUniversal && s.phases.includes(phase),
                          );
                          if (!phaseSignals.length) return null;
                          return (
                            <optgroup key={phase} label={formatPhaseLabel(phase)}>
                              {phaseSignals.map((s) => (
                                <option key={s.key} value={s.key}>
                                  {s.displayNameDefault}
                                </option>
                              ))}
                            </optgroup>
                          );
                        })}
                        <optgroup label="Book look">
                          {tenantSignalDefs.filter((s) => s.phases[0] === LESSON_PHASE.BOOKS).map((s) => (
                            <option key={s.key} value={s.key}>
                              {s.displayNameDefault}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">
                        Priority
                      </span>
                      <select
                        form="signals-explorer-filters"
                        name="priority"
                        defaultValue={priorityFilter ?? ""}
                        className="field field-filter-trigger !rounded-[10px] !border-[#E5E7EB] !py-2.5 !text-[0.8125rem]"
                      >
                        <option value="">All priorities</option>
                        {PRIORITY_LEVELS.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <p className="mt-3 text-[0.75rem] text-[#6B7280]">
                    Choose options, then use{" "}
                    <span className="font-medium text-[#111827]">Apply Filters</span>{" "}
                    to update the table.
                  </p>
                </div>
              </details>
              {showExport && (
                <form action="/api/explorer/export" method="POST" className="contents">
                  <input type="hidden" name="view" value="CPD_SIGNAL_PRIORITIES" />
                  <input type="hidden" name="windowDays" value={String(windowDays)} />
                  {departmentId && (
                    <input type="hidden" name="departmentId" value={departmentId} />
                  )}
                  {signalKeyFilter && (
                    <input type="hidden" name="signalKey" value={signalKeyFilter} />
                  )}
                  {priorityFilter && (
                    <input type="hidden" name="priority" value={priorityFilter} />
                  )}
                  <button
                    type="submit"
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-[10px] border border-[#E5E7EB] bg-white px-4 text-[0.8125rem] font-medium text-[#374151] shadow-sm hover:bg-[#F9FAFB] sm:w-auto"
                  >
                    <svg className="h-4 w-4 shrink-0 text-[#6B7280]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    Export Data
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
          <StatCard
            layout="kpi"
            label="Total Signals"
            value={totalSignals}
            tone="glass"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5 10.5 6.75l3 3 6.75-6.75M3.75 13.5v5.25a.75.75 0 0 0 .75.75h5.25M3.75 13.5h5.25" />
              </svg>
            }
            iconTileClassName="rounded-md bg-emerald-50 text-[#10B981]"
            context={
              <div className="space-y-2">
                <span
                  className={`inline-flex w-fit items-center rounded-md px-2.5 py-0.5 text-[0.6875rem] font-semibold ${
                    totalSignalsTrendPct >= 0
                      ? "bg-emerald-50 text-[#059669]"
                      : "bg-red-50 text-[#DC2626]"
                  }`}
                >
                  {totalSignalsTrendPct >= 0 ? "↑" : "↓"} {Math.abs(totalSignalsTrendPct)}%
                </span>
                <p className="text-[0.8125rem] text-[#6B7280]">
                  vs previous {windowDays} days
                </p>
              </div>
            }
          />
          <StatCard
            layout="kpi"
            label="Critical Drift"
            value={totalDrifting}
            tone="glass"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12V15Z" />
              </svg>
            }
            iconTileClassName="rounded-md bg-red-50 text-[#EF4444]"
            context={
              <div className="space-y-2">
                <span
                  className={`inline-flex w-fit rounded-md px-2.5 py-0.5 text-[0.6875rem] font-semibold ${
                    totalDrifting > 0 ? "bg-red-50 text-[#B91C1C]" : "bg-[#F3F4F6] text-[#6B7280]"
                  }`}
                >
                  {totalDrifting > 0 ? "High Priority" : "Low risk"}
                </span>
                <p className="text-[0.8125rem] text-[#6B7280]">
                  {totalDrifting > 0
                    ? "Needs immediate attention"
                    : "No critical drift in this window"}
                </p>
              </div>
            }
          />
          <StatCard
            layout="kpi"
            label="Avg. Drift Rate"
            value={pct(avgDriftRate)}
            tone="glass"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
              </svg>
            }
            iconTileClassName="rounded-md bg-sky-50 text-[#0EA5E9]"
            context={
              <div className="space-y-2">
                <span className="inline-flex w-fit rounded-md bg-[#F3F4F6] px-2.5 py-0.5 text-[0.6875rem] font-semibold text-[#6B7280]">
                  System Mean
                </span>
                <p className="text-[0.8125rem] text-[#6B7280]">Across all signals</p>
              </div>
            }
          />
          <StatCard
            layout="kpi"
            label="Improvement Index"
            value={improvementIndex.toFixed(1)}
            tone="glass"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
              </svg>
            }
            iconTileClassName="rounded-md bg-emerald-50 text-[#10B981]"
            context={
              <div className="space-y-2">
                <span
                  className={`inline-flex w-fit rounded-md px-2.5 py-0.5 text-[0.6875rem] font-semibold ${improvementMeta.pillClass}`}
                >
                  {improvementMeta.label}
                </span>
                <p className="text-[0.8125rem] text-[#6B7280]">Overall performance</p>
              </div>
            }
          />
        </div>

        {sortedRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#E5E7EB] bg-white py-16">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-md bg-[#F3F4F6]">
              <svg className="h-6 w-6 text-[#6B7280]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
              </svg>
            </div>
            <p className="text-[0.875rem] font-semibold text-[#111827]">No signals found</p>
            <p className="mt-1 text-[0.8125rem] text-[#6B7280]">
              Try adjusting your window or department filter.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[color-mix(in_srgb,#E5E7EB_90%,transparent)] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <p className="sr-only" id="explorer-signals-scroll-hint">
              This table scrolls horizontally on small screens. Use touch or trackpad to see all columns.
            </p>
            <div className="overflow-x-auto" aria-describedby="explorer-signals-scroll-hint">
              <table className="w-full min-w-[880px] text-[0.8125rem]">
                <thead>
                  <tr className="border-b border-[#F3F4F6] bg-[#FAFAFA] text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-[#6B7280]">
                    <th className="py-3.5 pl-5 pr-3">Signal</th>
                    <th className="px-3 py-3.5 text-right">Teachers</th>
                    <th className="px-3 py-3.5 text-right">Drifting</th>
                    <th className="px-3 py-3.5 text-right">
                      <span className="inline-flex items-center justify-end gap-1">
                        Drift Rate
                        <InfoHint label="Share of covered teachers whose signal weakened beyond the drift threshold in this window." />
                      </span>
                    </th>
                    <th className="px-3 py-3.5 text-right">Avg Drift</th>
                    <th className="px-3 py-3.5 text-center">Priority</th>
                    <th className="px-3 py-3.5 text-right">Improving</th>
                    <th className="px-3 py-3.5 pr-5 text-right">
                      <span className="inline-flex items-center justify-end gap-1">
                        Impr. Rate
                        <InfoHint label="Share of covered teachers showing meaningful improvement on this signal." />
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6]">
                  {sortedRows.map((row) => {
                    const priority = getPriorityLevel(row);
                    const stripe = getPriorityStripeClass(priority);
                    const barWidth = maxDriftRate > 0 ? (row.driftRate / maxDriftRate) * 100 : 0;
                    return (
                      <ClickableRow
                        key={row.signalKey}
                        href={`/analysis/cpd/${encodeURIComponent(row.signalKey)}`}
                        className={`group calm-transition cursor-pointer bg-white hover:bg-[#FAFAFA] ${stripe}`}
                      >
                        <td className="py-4 pl-4 pr-3">
                          <Link
                            href={`/analysis/cpd/${encodeURIComponent(row.signalKey)}`}
                            className="font-medium text-[#111827] underline decoration-[color-mix(in_srgb,#111827_35%,transparent)] underline-offset-2 hover:decoration-[#111827]"
                            title={row.label}
                          >
                            <span className="block max-w-[200px] truncate">{row.label}</span>
                          </Link>
                        </td>
                        <td className="px-3 py-4 text-right tabular-nums text-[#6B7280]">
                          {row.teachersCovered}
                        </td>
                        <td
                          className={`px-3 py-4 text-right tabular-nums font-semibold ${
                            row.teachersDriftingDown > 10 ? "text-[#EF4444]" : "text-[#111827]"
                          }`}
                        >
                          {row.teachersDriftingDown}
                        </td>
                        <td className="px-3 py-4 text-right">
                          <div className="flex items-center justify-end gap-2.5">
                            <span className="tabular-nums text-[#111827]">{pct(row.driftRate)}</span>
                            <div className="h-2 w-[4.5rem] shrink-0 overflow-hidden rounded-sm bg-[#F3F4F6]">
                              <div
                                className={`h-full rounded-md ${getDriftBarColor(row.driftRate)}`}
                                style={{ width: `${barWidth}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-4 text-right tabular-nums text-[#6B7280]">
                          {row.avgNegDeltaAbs ? row.avgNegDeltaAbs.toFixed(1) : "—"}
                        </td>
                        <td className="px-3 py-4 text-center">
                          <span
                            className={`inline-flex items-center rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${getPriorityPillClass(priority)}`}
                          >
                            {priority}
                          </span>
                        </td>
                        <td className="px-3 py-4 text-right tabular-nums text-[#6B7280]">
                          {row.teachersImproving}
                        </td>
                        <td className="px-3 py-4 pr-5 text-right tabular-nums font-semibold text-[#10B981]">
                          {pct(row.improvingRate)}
                        </td>
                      </ClickableRow>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-xl border border-[color-mix(in_srgb,#E5E7EB_90%,transparent)] bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-bold text-[#111827]">Overall Drift Trend</h2>
              <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">
                Last 7 Days
              </span>
            </div>

            <div className="mt-6 flex items-end justify-between gap-2">
              {driftTrend.days.map((d) => {
                const barHeight = maxBarHeight > 0
                  ? Math.max((d.observationCount / maxBarHeight) * 100, d.observationCount > 0 ? 12 : 0)
                  : 0;
                const isHighDrift = d.driftScore > 0.3;
                return (
                  <div key={d.dayLabel} className="flex flex-1 flex-col items-center gap-2">
                    <div className="flex h-28 w-full items-end justify-center">
                      <div
                        className={`w-full max-w-[36px] rounded-t-md ${
                          isHighDrift ? "bg-[#F87171]" : "bg-[#111827]"
                        }`}
                        style={{ height: `${barHeight}%` }}
                      />
                    </div>
                    <span className="text-[0.625rem] font-medium uppercase text-[#6B7280]">{d.dayLabel}</span>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex items-start gap-2 border-t border-[#F3F4F6] pt-4">
              <p className="flex-1 text-[0.8125rem] text-[#6B7280]">
                {driftTrend.weekOverWeekChange <= 0 ? (
                  <>
                    System-wide drift reduced by{" "}
                    <span className="font-semibold text-[#111827]">
                      {Math.abs(driftTrend.weekOverWeekChange).toFixed(1)}%
                    </span>{" "}
                    compared to previous week.
                  </>
                ) : (
                  <>
                    System-wide drift increased by{" "}
                    <span className="font-semibold text-[#111827]">
                      {driftTrend.weekOverWeekChange.toFixed(1)}%
                    </span>{" "}
                    compared to previous week.
                  </>
                )}
              </p>
              {driftTrend.weekOverWeekChange <= 0 ? (
                <svg className="h-5 w-5 shrink-0 text-[#10B981]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6 9 12.75l4.286-4.286a11.948 11.948 0 0 1 4.306 6.43l.776 2.898m0 0 3.182-5.511m-3.182 5.51-5.511-3.181" />
                </svg>
              ) : (
                <svg className="h-5 w-5 shrink-0 text-[#EF4444]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
                </svg>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-[color-mix(in_srgb,#E5E7EB_90%,transparent)] bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <h2 className="text-base font-bold text-[#111827]">Top Improving Signals</h2>
            <div className="mt-4 space-y-3">
              {improving.length > 0 ? (
                improving.map((row) => (
                  <div
                    key={row.signalKey}
                    className="flex items-center gap-4 rounded-[10px] border border-[#F3F4F6] bg-[#FAFAFA] p-4"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-emerald-50">
                      <svg className="h-5 w-5 text-[#10B981]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-[#111827]">
                        <Link
                          href={`/analysis/cpd/${encodeURIComponent(row.signalKey)}`}
                          className="underline decoration-[color-mix(in_srgb,#111827_35%,transparent)] underline-offset-2 hover:decoration-[#111827]"
                        >
                          {row.label}
                        </Link>
                      </p>
                      <p className="text-[0.75rem] text-[#6B7280]">{pct(row.improvingRate)} improvement rate</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="py-8 text-center text-[0.8125rem] text-[#6B7280]">
                  No improving signals in this window.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
