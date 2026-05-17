import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { buildViewerContext } from "@/lib/viewerContext";
import { parseWindow } from "@/lib/explorerUtils";
import { PageHeader } from "@/components/ui/page-header";
import { ExplorerBackLink } from "@/components/explorer/explorer-chrome";
import {
  canViewExplorer,
  canViewAssessmentExplorer,
  canExportExplorer,
} from "@/modules/authz";
import { computeAssessmentAnalysis } from "@/modules/analysis/assessmentAnalysis";

/* ─── Helpers ───────────────────────────────────────────────────────────────── */

function fmt(n: number | null, digits = 1): string {
  if (n === null) return "—";
  return (n * 100).toFixed(digits) + "%";
}

function movementStr(m: number | null): string {
  if (m === null) return "—";
  return (m >= 0 ? "+" : "") + (m * 100).toFixed(1) + "pp";
}

function cellHeatClass(mean: number | null): string {
  if (mean === null) return "text-muted bg-transparent";
  if (mean >= 0.7) return "bg-[color-mix(in_srgb,var(--scale-consistent-light,#DCFCE7)_60%,transparent)] text-[#166534]";
  if (mean >= 0.55) return "bg-[color-mix(in_srgb,#FEF9C3_60%,transparent)] text-[#713F12]";
  if (mean >= 0.4) return "bg-[color-mix(in_srgb,var(--scale-limited-light,#FEE2E2)_40%,transparent)] text-[#991B1B]";
  return "bg-[color-mix(in_srgb,var(--scale-limited-light,#FEE2E2)_70%,transparent)] font-semibold text-[#7F1D1D]";
}

function gapClass(gap: number | null): string {
  if (gap === null) return "text-muted";
  if (gap > 0.15) return "text-[var(--error)] font-semibold";
  if (gap > 0.08) return "text-[var(--error)]";
  return "text-muted";
}

function movementClass(m: number | null): string {
  if (m === null) return "text-muted";
  if (m < -0.05) return "text-[var(--error)]";
  if (m > 0.05) return "text-[var(--pill-success-text)]";
  return "text-muted";
}

/* ─── Page ───────────────────────────────────────────────────────────────────── */

export default async function AssessmentCohortsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ANALYSIS");

  const viewerContext = await buildViewerContext(user);

  if (!canViewExplorer(viewerContext) || !canViewAssessmentExplorer(viewerContext)) notFound();

  const windowDays = parseWindow(
    Array.isArray(params.windowDays) ? params.windowDays[0] : params.windowDays,
  );
  const cycleId = Array.isArray(params.cycle) ? params.cycle[0] : params.cycle;
  const yearGroupFilter = (Array.isArray(params.yearGroup) ? params.yearGroup[0] : params.yearGroup) ?? "";
  const viewMode = (Array.isArray(params.view) ? params.view[0] : params.view) ?? "mean";

  const assessment = await computeAssessmentAnalysis(
    user.tenantId,
    cycleId ? { cycleId } : undefined,
  );

  const showExport = canExportExplorer(viewerContext);

  // ── Build pivot ─────────────────────────────────────────────────────────────

  let cohortRows = assessment.cohorts;
  if (yearGroupFilter) {
    cohortRows = cohortRows.filter((r) => r.yearGroup === yearGroupFilter);
  }

  const yearGroups = Array.from(new Set(assessment.cohorts.map((r) => r.yearGroup))).sort();
  const subjects = Array.from(new Set(cohortRows.map((r) => r.subject))).sort();

  // Build lookup: yearGroup → subject → row
  const lookup = new Map<string, Map<string, typeof cohortRows[0]>>();
  for (const row of cohortRows) {
    if (!lookup.has(row.yearGroup)) lookup.set(row.yearGroup, new Map());
    lookup.get(row.yearGroup)!.set(row.subject, row);
  }

  const displayYearGroups = yearGroupFilter ? [yearGroupFilter] : yearGroups;

  // KPI derivations
  const schoolWideMean =
    cohortRows.filter((r) => r.meanNormalizedScore !== null).length > 0
      ? cohortRows.filter((r) => r.meanNormalizedScore !== null).reduce((s, r) => s + r.meanNormalizedScore!, 0) /
        cohortRows.filter((r) => r.meanNormalizedScore !== null).length
      : null;

  const avgSendGap =
    cohortRows.filter((r) => r.sendGap !== null).length > 0
      ? cohortRows.filter((r) => r.sendGap !== null).reduce((s, r) => s + r.sendGap!, 0) /
        cohortRows.filter((r) => r.sendGap !== null).length
      : null;

  const avgPpGap =
    cohortRows.filter((r) => r.ppGap !== null).length > 0
      ? cohortRows.filter((r) => r.ppGap !== null).reduce((s, r) => s + r.ppGap!, 0) /
        cohortRows.filter((r) => r.ppGap !== null).length
      : null;

  const decliningCells = cohortRows.filter((r) => r.movement !== null && r.movement < -0.05).length;

  const computedAtStr = assessment.computedAt.toLocaleDateString("en-GB");

  function viewUrl(v: string): string {
    const qs = new URLSearchParams({
      windowDays: String(windowDays),
      ...(cycleId ? { cycle: cycleId } : {}),
      ...(yearGroupFilter ? { yearGroup: yearGroupFilter } : {}),
      view: v,
    });
    return `/explorer/assessment/cohorts?${qs}`;
  }

  function yearUrl(yg: string): string {
    const qs = new URLSearchParams({
      windowDays: String(windowDays),
      ...(cycleId ? { cycle: cycleId } : {}),
      view: viewMode,
      ...(yearGroupFilter === yg ? {} : { yearGroup: yg }),
    });
    return `/explorer/assessment/cohorts?${qs}`;
  }

  function getCellValue(row: typeof cohortRows[0] | undefined): string {
    if (!row) return "—";
    switch (viewMode) {
      case "mean": return fmt(row.meanNormalizedScore);
      case "movement": return movementStr(row.movement);
      case "sendGap": return row.sendGap !== null ? fmt(row.sendGap) : "—";
      case "ppGap": return row.ppGap !== null ? fmt(row.ppGap) : "—";
      default: return fmt(row.meanNormalizedScore);
    }
  }

  function getCellClass(row: typeof cohortRows[0] | undefined): string {
    if (!row) return "text-muted bg-transparent";
    switch (viewMode) {
      case "mean": return cellHeatClass(row.meanNormalizedScore);
      case "movement": return movementClass(row.movement);
      case "sendGap": return gapClass(row.sendGap);
      case "ppGap": return gapClass(row.ppGap);
      default: return cellHeatClass(row.meanNormalizedScore);
    }
  }

  return (
    <div className="space-y-8">
      <ExplorerBackLink />

      <PageHeader
        variant="ledger"
        eyebrow="Explorer · Assessment"
        title="Cohorts"
        subtitle="Year group × subject pivot with prior attainment bands, SEND/PP gaps, and movement."
        actions={
          showExport ? (
            <form action="/api/explorer/export" method="POST" className="inline">
              <input type="hidden" name="view" value="ASSESSMENT_COHORTS" />
              <input type="hidden" name="windowDays" value={String(windowDays)} />
              {cycleId && <input type="hidden" name="cycle" value={cycleId} />}
              <button type="submit" className="anx-btn-pill-ghost calm-transition font-semibold">
                <svg className="anx-icon-inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
                  <polyline points="7 10 12 15 17 10" strokeLinecap="round" strokeLinejoin="round" />
                  <line x1="12" y1="15" x2="12" y2="3" strokeLinecap="round" />
                </svg>
                Export CSV
              </button>
            </form>
          ) : undefined
        }
      />

      {/* ── KPI strip ───────────────────────────────────────────────────────── */}
      <div className="explorer-kpi-tile rounded-2xl p-6">
        <div className="grid gap-6 sm:grid-cols-4 lg:gap-0 lg:divide-x lg:divide-[color-mix(in_srgb,var(--outline-variant)_22%,transparent)]">
          <div className="lg:pr-8">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">School-wide mean</p>
            <p className="mt-1 text-[2.25rem] font-bold tabular-nums tracking-[-0.03em] text-text">{fmt(schoolWideMean)}</p>
          </div>
          <div className="lg:px-8">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Declining cells</p>
            <p className={`mt-1 text-[2.25rem] font-bold tabular-nums tracking-[-0.03em] ${decliningCells > 0 ? "text-[var(--error)]" : "text-text"}`}>{decliningCells}</p>
            <p className="text-[11px] text-muted">year × subject pairs</p>
          </div>
          <div className="lg:px-8">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Avg SEND gap</p>
            <p className={`mt-1 text-[2.25rem] font-bold tabular-nums tracking-[-0.03em] ${avgSendGap !== null && avgSendGap > 0.08 ? "text-[var(--error)]" : "text-text"}`}>{fmt(avgSendGap)}</p>
          </div>
          <div className="lg:pl-8">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Avg PP gap</p>
            <p className={`mt-1 text-[2.25rem] font-bold tabular-nums tracking-[-0.03em] ${avgPpGap !== null && avgPpGap > 0.08 ? "text-[var(--error)]" : "text-text"}`}>{fmt(avgPpGap)}</p>
          </div>
        </div>
      </div>

      {/* ── View mode + year group filters ───────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Show:</span>
          {[
            { key: "mean", label: "Mean score" },
            { key: "movement", label: "Movement" },
            { key: "sendGap", label: "SEND gap" },
            { key: "ppGap", label: "PP gap" },
          ].map(({ key, label }) => (
            <Link
              key={key}
              href={viewUrl(key)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium calm-transition ${
                viewMode === key
                  ? "bg-accent text-on-primary"
                  : "border border-border text-muted hover:border-accent/50 hover:text-text"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
        {yearGroups.length > 1 && (
          <div className="flex items-center gap-1">
            <span className="mr-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Year:</span>
            {yearGroupFilter && (
              <Link
                href={yearUrl(yearGroupFilter)}
                className="rounded-md border border-border px-2.5 py-1 text-[11px] font-medium text-muted calm-transition hover:border-accent/50 hover:text-text"
              >
                All
              </Link>
            )}
            {yearGroups.map((yg) => (
              <Link
                key={yg}
                href={yearUrl(yg)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium calm-transition ${
                  yearGroupFilter === yg
                    ? "bg-accent text-on-primary"
                    : "border border-border text-muted hover:border-accent/50 hover:text-text"
                }`}
              >
                {yg}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── Heat-map pivot grid ───────────────────────────────────────────────── */}
      {subjects.length === 0 || displayYearGroups.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16">
          <p className="text-[0.875rem] font-semibold text-text">No cohort data available</p>
          <p className="mt-1 text-[0.8125rem] text-muted">Ensure assessment cycles have published results linked to year groups.</p>
        </div>
      ) : (
        <div className="table-shell overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-head-row text-left">
                <th className="px-5 py-3 font-semibold">Year group</th>
                {subjects.map((s) => (
                  <th key={s} className="px-3 py-3 text-center text-[11px] font-medium">{s}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayYearGroups.map((yg) => {
                const subjectMap = lookup.get(yg);
                return (
                  <tr key={yg} className="group table-row">
                    <td className="px-5 py-3 font-semibold text-text">{yg}</td>
                    {subjects.map((s) => {
                      const row = subjectMap?.get(s);
                      const cellVal = getCellValue(row);
                      const cellCls = getCellClass(row);
                      return (
                        <td key={s} className={`px-3 py-3 text-center text-[12px] tabular-nums transition-colors ${cellCls}`}>
                          {cellVal}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Prior attainment band breakdown ──────────────────────────────────── */}
      {cohortRows.some((r) => r.lowPriorMean !== null || r.midPriorMean !== null || r.highPriorMean !== null) && (
        <div className="rounded-2xl border border-border bg-surface-container-low p-6">
          <h2 className="mb-4 text-sm font-semibold text-text">Prior attainment band breakdown</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-muted">
                  <th className="pb-2 pr-4 font-medium">Year</th>
                  <th className="pb-2 pr-4 font-medium">Subject</th>
                  <th className="pb-2 pr-4 font-medium">Low prior</th>
                  <th className="pb-2 pr-4 font-medium">Mid prior</th>
                  <th className="pb-2 pr-4 font-medium">High prior</th>
                  <th className="pb-2 pr-4 font-medium">SEND gap</th>
                  <th className="pb-2 font-medium">PP gap</th>
                </tr>
              </thead>
              <tbody>
                {cohortRows
                  .filter((r) => r.lowPriorMean !== null || r.midPriorMean !== null || r.highPriorMean !== null)
                  .map((r) => (
                    <tr key={`${r.yearGroup}-${r.subject}`} className="border-t border-border/10">
                      <td className="py-1.5 pr-4 font-medium text-text">{r.yearGroup}</td>
                      <td className="py-1.5 pr-4 text-text">{r.subject}</td>
                      <td className={`py-1.5 pr-4 tabular-nums ${cellHeatClass(r.lowPriorMean)}`}>{fmt(r.lowPriorMean)}</td>
                      <td className={`py-1.5 pr-4 tabular-nums ${cellHeatClass(r.midPriorMean)}`}>{fmt(r.midPriorMean)}</td>
                      <td className={`py-1.5 pr-4 tabular-nums ${cellHeatClass(r.highPriorMean)}`}>{fmt(r.highPriorMean)}</td>
                      <td className={`py-1.5 pr-4 tabular-nums ${gapClass(r.sendGap)}`}>{r.sendGap !== null ? fmt(r.sendGap) : "—"}</td>
                      <td className={`py-1.5 tabular-nums ${gapClass(r.ppGap)}`}>{r.ppGap !== null ? fmt(r.ppGap) : "—"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-[0.75rem] text-muted">
        Explorer · Assessment · Cohorts · Updated {computedAtStr}
      </p>
    </div>
  );
}
