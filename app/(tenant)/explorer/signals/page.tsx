import Link from "next/link";
import { ClickableRow } from "@/components/ui/clickable-row";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { H2 } from "@/components/ui/typography";
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

function delta(value: number | null): string {
  if (value === null) return "—";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}`;
}

function getPriorityLevel(row: CpdPriorityRow): "HIGH" | "MEDIUM" | "LOW" {
  if (row.driftRate > 0.20) return "HIGH";
  if (row.driftRate > 0.10) return "MEDIUM";
  return "LOW";
}

function getPriorityColor(level: "HIGH" | "MEDIUM" | "LOW") {
  if (level === "HIGH") return { border: "border-l-scale-limited-bar", text: "text-scale-limited-text", bg: "bg-scale-limited-bg" };
  if (level === "MEDIUM") return { border: "border-l-scale-some-bar", text: "text-scale-some-text", bg: "bg-scale-some-bg" };
  return { border: "border-l-scale-consistent-bar", text: "text-scale-consistent-text", bg: "bg-scale-consistent-bg" };
}

function getImprovementLabel(index: number): { label: string; color: string } {
  if (index >= 85) return { label: "Excellent", color: "text-scale-strong-text" };
  if (index >= 70) return { label: "Good", color: "text-scale-strong-text" };
  if (index >= 50) return { label: "Fair", color: "text-scale-some-text" };
  return { label: "Needs Work", color: "text-scale-limited-text" };
}

function getDriftBarColor(rate: number): string {
  if (rate > 0.20) return "bg-coral";
  return "bg-primary-container";
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

  // ── viewer context ──────────────────────────────────────────────
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

  // ── params ──────────────────────────────────────────────────────
  const windowDays = parseWindow(
    Array.isArray(params.windowDays)
      ? params.windowDays[0]
      : params.windowDays,
  );
  const rawDeptId = Array.isArray(params.departmentId)
    ? params.departmentId[0]
    : params.departmentId;

  const isHod = user.role === "HOD";

  // Validate the department filter against HOD scope
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

  // ── data ────────────────────────────────────────────────────────
  const [rows, departments, driftTrend] = await Promise.all([
    computeCpdPriorities(user.tenantId, windowDays, filters),
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

  // ── derived stats (respect signal / priority filters) ───────────
  const totalSignals = filteredRows.reduce((s, r) => s + r.teachersCovered, 0);
  const totalDrifting = filteredRows.reduce((s, r) => s + r.teachersDriftingDown, 0);
  const totalImproving = filteredRows.reduce((s, r) => s + r.teachersImproving, 0);
  const avgDriftRate = totalSignals > 0 ? totalDrifting / totalSignals : 0;
  const avgImprovingRate = totalSignals > 0 ? totalImproving / totalSignals : 0;
  const improvementIndex = totalSignals > 0 ? (1 - avgDriftRate) * 100 : 0;
  const improvementMeta = getImprovementLabel(improvementIndex);
  const maxDriftRate = Math.max(
    ...sortedRows.map((r) => r.driftRate),
    0.01,
  );
  const maxBarHeight = Math.max(...driftTrend.days.map((d) => d.observationCount), 1);
  const moreFiltersActive = Boolean(signalKeyFilter || priorityFilter);

  // ── url builder ─────────────────────────────────────────────────
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

  // ── render ──────────────────────────────────────────────────────
  return (
    <>
      {/* Back link */}
      <div className="mb-4">
        <Link
          href="/explorer"
          className="inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-muted calm-transition hover:text-accent"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to Explorer
        </Link>
      </div>

      {/* ── Header ─────────────────────────────────────────────── */}
      <PageHeader
        title="Signals Explorer"
        subtitle="Monitor and analyze instructional delivery across departments. Tracking drift rates and instructional consistency metrics."
      />

      {/* ── Filters (aligned with Observation History) ─────────── */}
      <div className="w-full rounded-2xl bg-surface-container-low p-5 shadow-ambient md:p-6">
        <div className="flex w-full flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end lg:gap-x-4 lg:gap-y-4">
          <div className="flex min-w-0 flex-col gap-1.5 lg:min-w-[220px] lg:flex-none">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
              Time window
            </span>
            <div className="filter-period-toggle w-fit max-w-full">
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
            className="flex min-w-0 flex-1 flex-col gap-1.5 lg:min-w-[200px] lg:max-w-[min(100%,320px)]"
          >
            <input type="hidden" name="windowDays" value={String(windowDays)} />
            <label className="flex flex-col gap-1.5">
              <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
                Department
              </span>
              <select
                name="departmentId"
                defaultValue={rawDeptId ?? ""}
                className="field !bg-surface-container-lowest rounded-[10px] !py-2.5 !text-[0.8125rem]"
              >
                <option value="">All Departments</option>
                {selectableDepts.map((d: any) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
          </form>

          <div className="relative flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:ml-auto lg:w-auto lg:flex-none">
            <button
              type="submit"
              form="signals-explorer-filters"
              className="field !flex w-full flex-nowrap items-center justify-center whitespace-nowrap border-0 bg-primary py-2.5 text-[0.8125rem] font-bold text-on-primary calm-transition hover:opacity-90 sm:min-w-[140px] lg:w-auto lg:min-w-[160px]"
            >
              Apply Filters
            </button>
            <details
              className="group w-full sm:w-auto"
              open={moreFiltersActive}
            >
              <summary className="field !flex w-full cursor-pointer list-none flex-nowrap items-center justify-center gap-1.5 whitespace-nowrap border border-border/40 bg-surface-container-lowest py-2.5 text-[0.8125rem] font-medium text-muted calm-transition marker:hidden hover:bg-surface-container-low hover:text-text sm:min-w-[140px] lg:w-auto lg:min-w-[160px] [&::-webkit-details-marker]:hidden group-open:border-border group-open:bg-surface-container-low group-open:text-text">
                <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
                </svg>
                More Filters
              </summary>
              <div className="absolute left-0 right-0 z-20 mt-2 rounded-xl border border-border/40 bg-surface-container-lowest p-4 shadow-ambient sm:left-auto sm:right-auto sm:min-w-[280px] lg:min-w-[300px]">
                <p className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
                  Refine table
                </p>
                <div className="flex flex-col gap-3">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
                      Signal
                    </span>
                    <select
                      form="signals-explorer-filters"
                      name="signalKey"
                      defaultValue={signalKeyFilter ?? ""}
                      className="field !bg-surface-container-low rounded-[10px] !py-2.5 !text-[0.8125rem]"
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
                    <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
                      Priority
                    </span>
                    <select
                      form="signals-explorer-filters"
                      name="priority"
                      defaultValue={priorityFilter ?? ""}
                      className="field !bg-surface-container-low rounded-[10px] !py-2.5 !text-[0.8125rem]"
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
                <p className="mt-3 text-[0.75rem] text-muted">
                  Choose options, then use{" "}
                  <span className="font-medium text-text">Apply Filters</span>{" "}
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
                  className="field !flex w-full flex-nowrap items-center justify-center gap-1.5 whitespace-nowrap border border-primary bg-surface-container-lowest py-2.5 text-[0.8125rem] font-bold text-text calm-transition hover:bg-surface-container-low sm:min-w-[140px] lg:w-auto lg:min-w-[160px]"
                >
                  <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Export Data
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* ── Summary stat cards ─────────────────────────────────── */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Signals"
          value={totalSignals}
          tone="glass"
          contextVariant="inline"
          context={
            avgImprovingRate > 0 ? (
              <span className="font-semibold text-success">+{(avgImprovingRate * 100).toFixed(0)}%</span>
            ) : (
              <span className="font-medium text-muted">Stable</span>
            )
          }
        />
        <StatCard
          label="Critical Drift"
          value={totalDrifting}
          tone="glass"
          contextVariant="inline"
          context={
            totalDrifting > 0 ? (
              <span className="font-semibold text-error">High Priority</span>
            ) : (
              <span className="font-medium text-muted">Low risk</span>
            )
          }
        />
        <StatCard
          label="Avg. Drift Rate"
          value={pct(avgDriftRate)}
          tone="glass"
          contextVariant="inline"
          context={<span className="font-medium text-muted">System Mean</span>}
        />
        <StatCard
          label="Improvement Index"
          value={improvementIndex.toFixed(1)}
          tone="glass"
          contextVariant="inline"
          context={<span className={`font-semibold ${improvementMeta.color}`}>{improvementMeta.label}</span>}
        />
      </div>

      {/* ── Priority signals table ─────────────────────────────── */}
      {sortedRows.length === 0 ? (
        <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
            <svg className="h-6 w-6 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
            </svg>
          </div>
          <p className="text-[0.875rem] font-semibold text-text">No signals found</p>
          <p className="mt-1 text-[0.8125rem] text-muted">Try adjusting your window or department filter.</p>
        </div>
      ) : (
        <div className="mt-6 table-shell">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-head-row text-left">
                  <th className="py-3 pl-5 pr-3">Signal</th>
                  <th className="px-3 py-3 text-right">Teachers</th>
                  <th className="px-3 py-3 text-right">Drifting</th>
                  <th className="px-3 py-3 text-right">Drift Rate</th>
                  <th className="px-3 py-3 text-right">Avg Drift</th>
                  <th className="px-3 py-3 text-center">Priority</th>
                  <th className="px-3 py-3 text-right">Improving</th>
                  <th className="px-3 py-3 text-right">Impr. Rate</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row) => {
                  const priority = getPriorityLevel(row);
                  const colors = getPriorityColor(priority);
                  const barWidth = maxDriftRate > 0 ? (row.driftRate / maxDriftRate) * 100 : 0;
                  return (
                    <ClickableRow
                      key={row.signalKey}
                      href={`/analysis/cpd/${encodeURIComponent(row.signalKey)}`}
                      className={`group table-row calm-transition cursor-pointer border-l-[3px] ${colors.border}`}
                    >
                      <td className="py-3.5 pl-4 pr-3 font-medium text-text">
                        <Link
                          href={`/analysis/cpd/${encodeURIComponent(row.signalKey)}`}
                          className="calm-transition group-hover:text-accent hover:underline"
                          title={row.label}
                        >
                          <span className="block max-w-[140px] truncate">{row.label}</span>
                        </Link>
                      </td>
                      <td className="px-3 py-3.5 text-right tabular-nums text-muted">
                        {row.teachersCovered}
                      </td>
                      <td className={`px-3 py-3.5 text-right tabular-nums font-semibold ${
                        row.teachersDriftingDown > 10 ? "text-[var(--error)]" : "text-muted"
                      }`}>
                        {row.teachersDriftingDown}
                      </td>
                      <td className="px-3 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-2 w-16 overflow-hidden rounded-full bg-surface-container-low">
                            <div
                              className={`h-full rounded-full ${getDriftBarColor(row.driftRate)}`}
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                          <span className="tabular-nums text-muted">{pct(row.driftRate)}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3.5 text-right tabular-nums text-muted">
                        {row.avgNegDeltaAbs ? row.avgNegDeltaAbs.toFixed(1) : "—"}
                      </td>
                      <td className="px-3 py-3.5 text-center">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${colors.bg} ${colors.text}`}>
                          {priority}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-right tabular-nums text-muted">
                        {row.teachersImproving}
                      </td>
                      <td className="px-3 py-3.5 text-right tabular-nums font-semibold text-[var(--success)]">
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

      {/* ── Bottom section: Drift Trend + Top Improving ────────── */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {/* Overall Drift Trend */}
        <div className="rounded-2xl glass-card p-6">
          <div className="flex items-center justify-between">
            <H2>Overall Drift Trend</H2>
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">Last 7 Days</span>
          </div>

          {/* Bar chart */}
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
                        isHighDrift ? "bg-coral" : "bg-primary-container"
                      }`}
                      style={{ height: `${barHeight}%` }}
                    />
                  </div>
                  <span className="text-[0.625rem] font-medium uppercase text-muted">{d.dayLabel}</span>
                </div>
              );
            })}
          </div>

          {/* Trend summary */}
          <div className="mt-6 flex items-center gap-2 border-t border-border/20 pt-4">
            <p className="text-[0.8125rem] text-muted">
              {driftTrend.weekOverWeekChange <= 0 ? (
                <>System-wide drift reduced by <span className="font-semibold text-text">{Math.abs(driftTrend.weekOverWeekChange).toFixed(1)}%</span> compared to previous week.</>
              ) : (
                <>System-wide drift increased by <span className="font-semibold text-text">{driftTrend.weekOverWeekChange.toFixed(1)}%</span> compared to previous week.</>
              )}
            </p>
            {driftTrend.weekOverWeekChange <= 0 ? (
              <svg className="h-5 w-5 shrink-0 text-[var(--success)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6 9 12.75l4.286-4.286a11.948 11.948 0 0 1 4.306 6.43l.776 2.898m0 0 3.182-5.511m-3.182 5.51-5.511-3.181" />
              </svg>
            ) : (
              <svg className="h-5 w-5 shrink-0 text-[var(--error)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
              </svg>
            )}
          </div>
        </div>

        {/* Top Improving Signals */}
        <div className="rounded-2xl glass-card p-6">
          <H2>Top Improving Signals</H2>
          <div className="mt-4 space-y-3">
            {improving.length > 0 ? (
              improving.map((row) => (
                <div
                  key={row.signalKey}
                  className="flex items-center gap-4 rounded-xl border border-border/20 bg-surface-container-lowest/50 p-4"
                >
                  {/* Arrow icon */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-scale-strong-bg">
                    <svg className="h-5 w-5 text-[var(--success)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
                    </svg>
                  </div>
                  {/* Label */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-text">
                      <Link
                        href={`/analysis/cpd/${encodeURIComponent(row.signalKey)}`}
                        className="hover:underline"
                      >
                        {row.label}
                      </Link>
                    </p>
                    <p className="text-[0.75rem] text-muted">{pct(row.improvingRate)} improvement rate</p>
                  </div>
                  {/* Delta */}
                  <span className="shrink-0 text-lg font-bold text-text">
                    {delta(row.avgPositiveDelta)}
                  </span>
                </div>
              ))
            ) : (
              <p className="py-8 text-center text-[0.8125rem] text-muted">
                No improving signals in this window.
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
