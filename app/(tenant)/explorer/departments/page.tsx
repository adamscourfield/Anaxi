import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { ExplorerBackLink } from "@/components/explorer/explorer-chrome";
import { H3, MetaText } from "@/components/ui/typography";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { canViewExplorer, canExportExplorer } from "@/modules/authz";
import { getSignalDefinitionsForSchoolType } from "@/modules/observations/getSignalsBySchoolType";
import {
  computeDepartmentPivot,
  type DepartmentPivotRow,
} from "@/modules/analysis/departmentPivot";
import { DepartmentsTable } from "./DepartmentsTable";
import { AutoSubmitSelect } from "./AutoSubmitSelect";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const WINDOW_OPTIONS = [7, 21, 28] as const;
type WindowDays = (typeof WINDOW_OPTIONS)[number];

function isValidWindow(v: unknown): v is WindowDays {
  return WINDOW_OPTIONS.includes(Number(v) as WindowDays);
}

/** Map a signal mean to a heatmap dot color. */
function meanToColor(mean: number | null | undefined): "green" | "amber" | "red" | "gray" {
  if (mean === null || mean === undefined) return "gray";
  if (mean >= 3.0) return "green";
  if (mean >= 2.0) return "amber";
  return "red";
}

/** Derive an overall department status from its signal data. */
function deriveStatus(
  signalData: DepartmentPivotRow["signalData"],
): "STABLE" | "WARNING" | "DRIFTING" | "CRITICAL DRIFT" {
  const entries = Object.values(signalData).filter(
    (s) => s.currentMean !== null && s.currentMean !== undefined,
  );
  if (entries.length === 0) return "STABLE";

  const criticalCount = entries.filter((s) => s.currentMean! < 2.0).length;
  const moderateCount = entries.filter(
    (s) => s.currentMean! >= 2.0 && s.currentMean! < 3.0,
  ).length;
  const totalEntries = entries.length;

  if (criticalCount / totalEntries > 0.5) return "CRITICAL DRIFT";
  if (criticalCount / totalEntries > 0.25) return "DRIFTING";
  if ((criticalCount + moderateCount) / totalEntries > 0.4) return "WARNING";
  return "STABLE";
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default async function DepartmentsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  /* ---- Auth & feature gate ---- */
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ANALYSIS");

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

  if (!canViewExplorer(viewerContext)) notFound();

  const showExport = canExportExplorer(viewerContext);

  /* ---- Search params ---- */
  const rawWindow = String(searchParams.windowDays ?? "21");
  const windowDays: WindowDays = isValidWindow(rawWindow)
    ? (Number(rawWindow) as WindowDays)
    : 21;

  const rawDeptId =
    typeof searchParams.departmentId === "string"
      ? searchParams.departmentId
      : undefined;

  /* ---- Scoping: HODs only see their departments ---- */
  const isHod = user.role === "HOD";
  const scopeIds = isHod ? hodDepartmentIds : undefined;
  const filterIds = rawDeptId ? [rawDeptId] : scopeIds;

  /* ---- Data ---- */
  const [{ rows }, departments, settings] = await Promise.all([
    computeDepartmentPivot(user.tenantId, windowDays, filterIds),
    (prisma as any).department.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }) as Promise<{ id: string; name: string }[]>,
    (prisma as any).tenantSettings.findUnique({ where: { tenantId: user.tenantId } }),
  ]);

  const schoolType = settings?.schoolType ?? "SECONDARY";
  const signalDefs = getSignalDefinitionsForSchoolType(schoolType);

  /* HOD-scoped department list for the filter dropdown */
  const selectableDepts = isHod
    ? departments.filter((d) => hodDepartmentIds.includes(d.id))
    : departments;

  /* ---- Sorting (alphabetical) ---- */
  const sortedRows = [...rows].sort((a, b) =>
    a.departmentName.localeCompare(b.departmentName),
  );

  /* ---- Summary stats ---- */
  const totalDepartments = sortedRows.length;
  const totalObservations = sortedRows.reduce(
    (sum, r) => sum + r.observationCount,
    0,
  );
  const totalSignals = signalDefs.length;

  /* Signal Integrity: % of departments with at least 1 observation */
  const deptsWithObs = sortedRows.filter((r) => r.observationCount > 0).length;
  const coveragePct =
    totalDepartments > 0
      ? Math.round((deptsWithObs / totalDepartments) * 100)
      : 0;

  /* Drift Analysis: aggregate drift & engagement score */
  const allDeltas = sortedRows.flatMap((r) =>
    Object.values(r.signalData)
      .filter((s) => s.delta !== null)
      .map((s) => s.delta!),
  );
  const negativeDeltas = allDeltas.filter((d) => d < 0);
  const aggregateDrift =
    negativeDeltas.length > 0
      ? Math.abs(
          negativeDeltas.reduce((a, b) => a + b, 0) / negativeDeltas.length,
        )
      : 0;
  const allMeans = sortedRows.flatMap((r) =>
    Object.values(r.signalData)
      .filter((s) => s.currentMean !== null)
      .map((s) => s.currentMean!),
  );
  const engagementScore =
    allMeans.length > 0
      ? allMeans.reduce((a, b) => a + b, 0) / allMeans.length
      : 0;

  /* Faculty Action: count departments with critical drift status */
  const criticalDriftCount = sortedRows.filter(
    (r) => deriveStatus(r.signalData) === "CRITICAL DRIFT",
  ).length;
  const driftingCount = sortedRows.filter((r) => {
    const s = deriveStatus(r.signalData);
    return s === "CRITICAL DRIFT" || s === "DRIFTING";
  }).length;

  /* ---- Build table rows for client component ---- */
  const tableRows = sortedRows.map((row) => ({
    departmentId: row.departmentId,
    departmentName: row.departmentName,
    faculty: row.faculty,
    teacherCount: row.teacherCount,
    observationCount: row.observationCount,
    signalDots: signalDefs.map((s) => ({
      key: s.key,
      label: s.displayNameDefault,
      color: meanToColor(row.signalData[s.key]?.currentMean),
    })),
    status: deriveStatus(row.signalData),
  }));

  /* ---- URL helper for preserving params ---- */
  function buildUrl(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const merged: Record<string, string | undefined> = {
      windowDays: String(windowDays),
      departmentId: rawDeptId,
      ...overrides,
    };
    for (const [k, v] of Object.entries(merged)) {
      if (v !== undefined && v !== "") params.set(k, v);
    }
    return `/explorer/departments?${params.toString()}`;
  }

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="space-y-8">
      <ExplorerBackLink />

      {/* ── Header ─────────────────────────────────────────────── */}
      <PageHeader
        eyebrow="Explorer"
        title="Departments"
        meta={<MetaText>{totalSignals} signals monitored</MetaText>}
        subtitle={
          <span className="mt-2 block max-w-2xl border-l-2 border-border pl-4">
            Cross-institutional pedagogical signal monitoring and faculty
            observation data ledger.
          </span>
        }
        actions={
          showExport ? (
            <form action="/api/explorer/export" method="POST" className="shrink-0">
              <input type="hidden" name="view" value="INSTRUCTION_DEPARTMENTS_PIVOT" />
              <input type="hidden" name="windowDays" value={String(windowDays)} />
              {rawDeptId && (
                <input type="hidden" name="departmentId" value={rawDeptId} />
              )}
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-[0.8125rem] font-semibold text-on-primary calm-transition hover:bg-primary-container"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
                  <polyline points="7 10 12 15 17 10" strokeLinecap="round" strokeLinejoin="round" />
                  <line x1="12" y1="15" x2="12" y2="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Export CSV
              </button>
            </form>
          ) : undefined
        }
      />

      {/* ── Filter bar ─────────────────────────────────────────── */}
      <div className="mb-6 filter-panel">
      <div className="filter-bar">
        {/* Window toggle buttons */}
        <div className="filter-period-toggle">
          {WINDOW_OPTIONS.map((w) => (
            <Link
              key={w}
              href={buildUrl({ windowDays: String(w) })}
              className={`filter-period-btn ${windowDays === w ? "filter-period-btn-active" : ""}`}
            >
              {w}D
            </Link>
          ))}
        </div>

        {/* Department dropdown */}
        <form className="flex items-center gap-2">
          {/* Preserve windowDays */}
          <input type="hidden" name="windowDays" value={String(windowDays)} />
          <AutoSubmitSelect
            name="departmentId"
            defaultValue={rawDeptId ?? ""}
            className="field field-filter-trigger min-w-[180px] !py-1.5 !text-[0.8125rem]"
          >
            <option value="">All Departments</option>
            {selectableDepts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </AutoSubmitSelect>
          <noscript>
            <button type="submit" className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-on-primary">
              Apply
            </button>
          </noscript>
        </form>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Legend */}
        <div className="flex items-center gap-4 text-[0.75rem] font-medium text-muted">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full bg-risk-stable-text" />
            Stable
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full bg-scale-some-bar" />
            Moderate
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full bg-scale-limited-bar" />
            Critical
          </span>
        </div>
      </div>
      </div>

      {/* ── Table ──────────────────────────────────────────────── */}
      {sortedRows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
            <svg className="h-6 w-6 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16.5 16.5 3 3" strokeLinecap="round" />
            </svg>
          </div>
          <p className="text-[0.875rem] font-semibold text-text">No department data</p>
          <p className="mt-1 text-[0.8125rem] text-muted">
            Try widening the window period or adjusting filters.
          </p>
        </div>
      ) : (
        <DepartmentsTable rows={tableRows} />
      )}

      {/* ── Bottom summary cards ───────────────────────────────── */}
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {/* Signal Integrity */}
        <div className="flex flex-col justify-between rounded-2xl glass-card p-6">
          <div>
            <H3>Signal Integrity</H3>
            <div className="mt-3 flex items-baseline gap-3">
              <span className="text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-muted">
                Active Observations
              </span>
              <span className="text-lg font-bold tabular-nums text-text">
                {totalObservations}
              </span>
            </div>
            {/* Progress bar */}
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-container-high">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${coveragePct}%` }}
              />
            </div>
          </div>
          <p className="mt-4 text-[0.8125rem] text-muted">
            {coveragePct}% of departments observed in the last {windowDays} days.
            {coveragePct >= 80
              ? " Data reliability is high."
              : coveragePct >= 50
                ? " Data coverage is moderate."
                : " Data coverage needs improvement."}
          </p>
        </div>

        {/* Drift Analysis */}
        <div className="flex flex-col justify-between rounded-2xl glass-card p-6">
          <div>
            <H3>Drift Analysis</H3>
            <div className="mt-4 flex items-start gap-4">
              <div className="flex flex-col items-center">
                <span className="text-3xl font-bold text-scale-limited-bar">
                  {(aggregateDrift * 100).toFixed(0)}%
                </span>
                <span className="mt-1 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted">
                  Aggregate Drift
                </span>
              </div>
              <div className="mx-2 h-14 w-px bg-border" />
              <div className="flex flex-col items-center">
                <span className="text-3xl font-bold text-scale-strong-text">
                  +{engagementScore.toFixed(1)}
                </span>
                <span className="mt-1 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted">
                  Engagement Score
                </span>
              </div>
            </div>
          </div>
          <p className="mt-4 text-[0.8125rem] text-muted">
            Aggregated across all monitored signals including student-led
            participation metrics.
          </p>
        </div>

        {/* Faculty Action Required */}
        <div className="flex flex-col justify-between rounded-2xl bg-primary-container p-6 text-on-primary">
          <div>
            <H3>Faculty Action Required</H3>
            <p className="mt-3 text-[0.875rem] leading-relaxed text-on-primary-container">
              {driftingCount > 0
                ? `${driftingCount} department${driftingCount !== 1 ? "s" : ""} currently show${driftingCount === 1 ? "s" : ""} critical drift in observation signals based on recent observations. Immediate intervention recommended.`
                : "All departments are currently within stable thresholds. Continue monitoring for any emerging patterns."}
            </p>
          </div>
          <div className="mt-4">
            <Link
              href="/explorer/teachers"
              className="inline-flex items-center gap-1.5 text-[0.8125rem] font-bold uppercase tracking-[0.04em] text-on-primary underline decoration-white/40 underline-offset-4 calm-transition hover:decoration-white"
            >
              Review Critical Reports
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <p className="mt-8 text-[0.75rem] text-muted">
        Explorer · Departments · {windowDays}d window
      </p>
    </div>
  );
}
