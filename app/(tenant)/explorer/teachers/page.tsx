import Link from "next/link";
import { ClickableRow } from "@/components/ui/clickable-row";
import { PageHeader } from "@/components/ui/page-header";
import { ExplorerBackLink } from "@/components/explorer/explorer-chrome";
import { ExplorerBreadcrumb } from "@/components/explorer/explorer-breadcrumb";
import { notFound } from "next/navigation";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { buildViewerContext } from "@/lib/viewerContext";
import { VALID_WINDOWS, type WindowDays, parseWindow } from "@/lib/explorerUtils";
import { canViewExplorer, canExportExplorer } from "@/modules/authz";
import { StatusPill, type PillVariant } from "@/components/ui/status-pill";
import { Avatar } from "@/components/ui/avatar";
import { getSignalDefinitionsForSchoolType } from "@/modules/observations/getSignalsBySchoolType";
import {
  computeTeacherPivot,
  computeTeacherRiskIndex,
  type RiskStatus,
  type TeacherPivotRow,
  type TeacherRiskRow,
} from "@/modules/analysis/teacherRisk";
import { TeachersFilterToolbar } from "@/components/teachers/TeachersFilterToolbar";
import { TopDriverLinks } from "./TopDriverLinks";
import { meanToHeatmapBarClass } from "@/lib/analysis/signalHeatmap";
import { SignalHeatmapClient } from "@/components/teachers/SignalHeatmapClient";
import { TablePagination } from "@/components/ui/table-pagination";

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

const STATUS_LABELS: Record<RiskStatus, string> = {
  SIGNIFICANT_DRIFT: "Significant",
  EMERGING_DRIFT: "Emerging",
  STABLE: "Consistent",
  LOW_COVERAGE: "Low coverage",
};

const STATUS_VARIANT: Record<RiskStatus, PillVariant> = {
  SIGNIFICANT_DRIFT: "error",
  EMERGING_DRIFT: "neutral",
  STABLE: "success",
  LOW_COVERAGE: "neutral",
};

/** Teachers per page */
const ITEMS_PER_PAGE = 20;

/** Format drift score with sign and trend arrow */
function formatDrift(value: number): { text: string; arrow: string; color: string } {
  const abs = Math.abs(value);
  const formatted = abs.toFixed(1);
  if (value > 0.5) return { text: `+${formatted}`, arrow: "↗", color: "text-scale-strong-text" };
  if (value < -0.5) return { text: `-${formatted}`, arrow: "↘", color: "text-scale-limited-text" };
  const sign = value < 0 ? "-" : "+";
  return { text: `${sign}${formatted}`, arrow: "→", color: "text-muted" };
}

/** Zero-pad a number to 2 digits */
function zeroPad(n: number): string {
  return String(n).padStart(2, "0");
}

/* ─── Page ─────────────────────────────────────────────────────────────────── */

export default async function ExplorerTeachersPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ANALYSIS");
  const resolvedSearchParams = (await searchParams) ?? {};

  const viewerContext = await buildViewerContext(user);

  if (!canViewExplorer(viewerContext)) notFound();

  const settings = await (prisma as any).tenantSettings.findUnique({ where: { tenantId: user.tenantId } });
  const schoolType = settings?.schoolType ?? "SECONDARY";
  const signalDefs = getSignalDefinitionsForSchoolType(schoolType);
  const signalKeys = signalDefs.map((s) => s.key);
  const signalLabelMap: Record<string, string> = Object.fromEntries(
    signalDefs.map((s) => [s.key, s.displayNameDefault]),
  );
  const heatmapKeys = signalKeys.slice(0, 6);

  // ─── Parse search params ────────────────────────────────────────────────────
  const windowDays = parseWindow(
    typeof resolvedSearchParams.windowDays === "string" ? resolvedSearchParams.windowDays : undefined,
  );

  const mode =
    typeof resolvedSearchParams.mode === "string" && resolvedSearchParams.mode === "priorities"
      ? "priorities"
      : "pivot";

  const sort =
    typeof resolvedSearchParams.sort === "string" &&
    ["drift", "coverage", "name"].includes(resolvedSearchParams.sort)
      ? (resolvedSearchParams.sort as "drift" | "coverage" | "name")
      : "drift";

  const dir =
    typeof resolvedSearchParams.dir === "string" && ["asc", "desc"].includes(resolvedSearchParams.dir)
      ? (resolvedSearchParams.dir as "asc" | "desc")
      : "desc";

  const departmentId =
    typeof resolvedSearchParams.departmentId === "string" ? resolvedSearchParams.departmentId : undefined;

  const rawPage = Number(
    typeof resolvedSearchParams.page === "string" ? resolvedSearchParams.page : "1",
  );
  const page = rawPage >= 1 ? Math.floor(rawPage) : 1;

  // ─── Load departments for filter ────────────────────────────────────────────
  const departments: { id: string; name: string }[] = await (prisma as any).department.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  // ─── HOD scope: restrict departments to those the HOD leads ─────────────────
  const isHod = user.role === "HOD";
  const scopedDepartments = isHod
    ? departments.filter((d) => viewerContext.hodDepartmentIds.includes(d.id))
    : departments;

  // ─── Fetch data ─────────────────────────────────────────────────────────────
  let pivotRows: TeacherPivotRow[] = [];
  let riskRows: TeacherRiskRow[] = [];

  if (mode === "pivot") {
    const result = await computeTeacherPivot(user.tenantId, windowDays);
    pivotRows = result.rows;
  } else {
    const [riskResult, pivotResult] = await Promise.all([
      computeTeacherRiskIndex(user.tenantId, windowDays),
      computeTeacherPivot(user.tenantId, windowDays),
    ]);
    riskRows = riskResult;
    pivotRows = pivotResult.rows;
  }

  // ─── HOD scope filter ───────────────────────────────────────────────────────
  if (isHod && viewerContext.hodDepartmentIds.length > 0) {
    const hodDeptNameSet = new Set(
      scopedDepartments.map((d) => d.name),
    );
    if (mode === "pivot") {
      pivotRows = pivotRows.filter((r) =>
        r.departmentNames.some((dn) => hodDeptNameSet.has(dn)),
      );
    } else {
      riskRows = riskRows.filter((r) =>
        r.departmentNames.some((dn) => hodDeptNameSet.has(dn)),
      );
    }
  }

  // ─── Department filter ──────────────────────────────────────────────────────
  if (departmentId) {
    const dept = departments.find((d) => d.id === departmentId);
    if (dept) {
      if (mode === "pivot") {
        pivotRows = pivotRows.filter((r) => r.departmentNames.includes(dept.name));
      } else {
        riskRows = riskRows.filter((r) => r.departmentNames.includes(dept.name));
      }
    }
  }

  if (mode === "pivot") {
    const multiplier = dir === "asc" ? 1 : -1;
    pivotRows.sort((a, b) => {
      if (sort === "drift") return (a.normalizedIDS - b.normalizedIDS) * multiplier;
      if (sort === "coverage") return (a.teacherCoverage - b.teacherCoverage) * multiplier;
      return a.teacherName.localeCompare(b.teacherName) * multiplier;
    });
  }

  // ─── Sorting (priorities mode) ─────────────────────────────────────────────
  if (mode === "priorities") {
    const multiplier = dir === "asc" ? 1 : -1;
    riskRows.sort((a, b) => {
      if (sort === "drift") return (a.normalizedIDS - b.normalizedIDS) * multiplier;
      if (sort === "coverage") return (a.teacherCoverage - b.teacherCoverage) * multiplier;
      return a.teacherName.localeCompare(b.teacherName) * multiplier;
    });
  }

  const canExport = canExportExplorer(viewerContext);

  // ─── Pagination ─────────────────────────────────────────────────────────────
  const allRows = mode === "pivot" ? pivotRows : riskRows;
  const totalItems = allRows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIdx = Math.min(startIdx + ITEMS_PER_PAGE, totalItems);

  const pagedPivotRows = mode === "pivot" ? pivotRows.slice(startIdx, endIdx) : [];
  const pagedRiskRows = mode === "priorities" ? riskRows.slice(startIdx, endIdx) : [];
  const pivotSignalByTeacherId = new Map(
    pivotRows.map((row) => [row.teacherMembershipId, row.signalData]),
  );

  // ─── URL builder helpers ────────────────────────────────────────────────────
  function buildUrl(overrides: Record<string, string>) {
    const base: Record<string, string> = {
      windowDays: String(windowDays),
      mode,
      sort,
      dir,
    };
    if (departmentId) base.departmentId = departmentId;
    const merged = { ...base, ...overrides };
    // Remove empty values
    for (const key of Object.keys(merged)) {
      if (!merged[key]) delete merged[key];
    }
    const qs = new URLSearchParams(merged).toString();
    return `/explorer/teachers?${qs}`;
  }

  function sortUrl(column: string) {
    const newDir = sort === column && dir === "desc" ? "asc" : "desc";
    return buildUrl({ sort: column, dir: newDir, page: "1" });
  }

  function sortIndicator(column: string) {
    if (sort !== column) return "";
    return dir === "asc" ? " ↑" : " ↓";
  }

  function pageUrl(p: number) {
    return buildUrl({ page: String(p) });
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-10">
      <ExplorerBackLink section="Teachers" />

      <PageHeader
        variant="ledger"
        eyebrow={<ExplorerBreadcrumb items={[{ label: "Teachers" }]} />}
        title="Teachers"
        subtitle="Observation coverage, signal means, and drift — switch window and pivot vs priorities."
        actions={
          canExport ? (
            <form action="/api/explorer/export" method="POST">
              <input type="hidden" name="view" value="INSTRUCTION_TEACHERS_PIVOT" />
              <input type="hidden" name="windowDays" value={String(windowDays)} />
              {departmentId && <input type="hidden" name="departmentId" value={departmentId} />}
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--on-surface)] px-5 py-2.5 text-sm font-semibold text-[var(--surface-container-lowest)] shadow-none calm-transition hover:opacity-90 active:scale-[0.98]"
              >
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
                  <polyline points="7 10 12 15 17 10" strokeLinecap="round" strokeLinejoin="round" />
                  <line x1="12" y1="15" x2="12" y2="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Export CSV
              </button>
            </form>
          ) : undefined
        }
      />

      {/* ── Controls bar (matches teachers table filter design) ───────────── */}
      <TeachersFilterToolbar
        variant="explorer"
        windowDays={windowDays}
        mode={mode}
        sort={sort}
        dir={dir}
        departmentId={departmentId}
        scopedDepartments={scopedDepartments}
        buildUrl={buildUrl}
      />

      {/* ── Performance view (pivot) ────────────────────────────────────────── */}
      {mode === "pivot" && (
        <>
          {pivotRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-md bg-accent/10">
                <svg className="h-6 w-6 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                </svg>
              </div>
              <p className="text-[0.875rem] font-semibold text-text">No teachers found</p>
              <p className="mt-1 text-[0.8125rem] text-muted">Try adjusting the window or department filter.</p>
            </div>
          ) : (
            <div className="table-shell">
              <p className="sr-only" id="explorer-teachers-pivot-scroll-hint">
                This table scrolls horizontally on small screens. Use touch or trackpad to see all columns.
              </p>
              <div className="overflow-x-auto" aria-describedby="explorer-teachers-pivot-scroll-hint">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="table-head-row">
                      <th className="px-5 py-4">
                        <Link href={sortUrl("name")} className="calm-transition hover:text-[var(--text)]">
                          Teacher{sortIndicator("name")}
                        </Link>
                      </th>
                      <th className="px-4 py-4">Department</th>
                      <th className="px-4 py-4 text-center">
                        <Link href={sortUrl("coverage")} className="calm-transition hover:text-[var(--text)]">
                          Coverage{sortIndicator("coverage")}
                        </Link>
                      </th>
                      <th className="px-4 py-4">Status</th>
                      <th className="px-4 py-4 text-center">
                        <div className="inline-flex items-center justify-center gap-1.5">
                          <Link href={sortUrl("drift")} className="calm-transition hover:text-[var(--text)]">
                            Drift Score{sortIndicator("drift")}
                          </Link>
                          <span
                            className="inline-flex shrink-0 cursor-help text-[var(--on-surface-variant)]"
                            title="Instructional drift score (IDS) for the selected window, normalized across observations."
                          >
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                              <circle cx="12" cy="12" r="10" />
                              <path d="M12 16v-4M12 8h.01" strokeLinecap="round" />
                            </svg>
                            <span className="sr-only">
                              Instructional drift score for the selected window, normalized across observations.
                            </span>
                          </span>
                        </div>
                      </th>
                      <th className="min-w-[13.5rem] px-4 py-4">
                        <span className="inline-flex flex-col gap-0.5">
                          <span>Signal heatmap</span>
                          <span className="text-[0.625rem] font-normal normal-case tracking-normal text-muted">
                            Higher mean = stronger (1–4)
                          </span>
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedPivotRows.map((row) => {
                      const drift = formatDrift(row.normalizedIDS);
                      return (
                        <tr
                          key={row.teacherMembershipId}
                          className="group table-row calm-transition"
                        >
                          {/* Teacher */}
                          <td className="whitespace-nowrap px-5 py-5">
                            <Link
                              href={`/analysis/teachers/${row.teacherMembershipId}?window=${windowDays}&ref=explorer`}
                              className="flex items-center gap-3.5 calm-transition group-hover:text-accent"
                            >
                              <Avatar name={row.teacherName} size="md" />
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-[var(--text)]">{row.teacherName}</p>
                                <p className="truncate text-xs text-muted">Teacher</p>
                              </div>
                            </Link>
                          </td>

                          {/* Department */}
                          <td className="whitespace-nowrap px-4 py-5 text-muted">
                            {row.departmentNames.join(", ") || "—"}
                          </td>

                          {/* Coverage (zero-padded) */}
                          <td className="whitespace-nowrap px-4 py-5 text-center font-semibold tabular-nums text-[var(--text)]">
                            {zeroPad(row.teacherCoverage)}
                          </td>

                          {/* Status */}
                          <td className="whitespace-nowrap px-4 py-5">
                            <StatusPill variant={STATUS_VARIANT[row.status]} size="sm">
                              {STATUS_LABELS[row.status]}
                            </StatusPill>
                          </td>

                          {/* Drift Score */}
                          <td className="whitespace-nowrap px-4 py-5 text-center">
                            <span className={`inline-flex items-center gap-1 font-semibold tabular-nums ${drift.color}`}>
                              {drift.text}
                              <span className="text-xs" aria-hidden>
                                {drift.arrow}
                              </span>
                            </span>
                          </td>

                          {/* Signal Heatmap */}
                          <td className="min-w-[11rem] px-4 py-5">
                            <SignalHeatmapClient
                              cells={heatmapKeys.map((key) => {
                                const cell = row.signalData[key];
                                const mean = cell?.currentMean;
                                return {
                                  key,
                                  barClass: meanToHeatmapBarClass(mean),
                                  label: signalLabelMap[key] ?? key,
                                  mean,
                                  href: `/analysis/teachers/${row.teacherMembershipId}?window=${windowDays}&ref=explorer&signal=${key}#teacher-full-signal-profile`,
                                };
                              })}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Priority view ───────────────────────────────────────────────────── */}
      {mode === "priorities" && (
        <>
          {riskRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-md bg-accent/10">
                <svg className="h-6 w-6 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                </svg>
              </div>
              <p className="text-[0.875rem] font-semibold text-text">No teachers found</p>
              <p className="mt-1 text-[0.8125rem] text-muted">Try adjusting the window or department filter.</p>
            </div>
          ) : (
            <div className="table-shell">
              <p className="sr-only" id="explorer-teachers-priorities-scroll-hint">
                This table scrolls horizontally on small screens. Use touch or trackpad to see all columns.
              </p>
              <div className="overflow-x-auto" aria-describedby="explorer-teachers-priorities-scroll-hint">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="table-head-row">
                      <th className="px-5 py-4">
                        <Link href={sortUrl("name")} className="calm-transition hover:text-[var(--text)]">
                          Teacher{sortIndicator("name")}
                        </Link>
                      </th>
                      <th className="px-4 py-4">Department</th>
                      <th className="px-4 py-4 text-center">
                        <Link href={sortUrl("coverage")} className="calm-transition hover:text-[var(--text)]">
                          Coverage{sortIndicator("coverage")}
                        </Link>
                      </th>
                      <th className="px-4 py-4">Status</th>
                      <th className="px-4 py-4 text-center">
                        <div className="inline-flex items-center justify-center gap-1.5">
                          <Link href={sortUrl("drift")} className="calm-transition hover:text-[var(--text)]">
                            Drift Score{sortIndicator("drift")}
                          </Link>
                          <span
                            className="inline-flex shrink-0 cursor-help text-[var(--on-surface-variant)]"
                            title="Instructional drift score (IDS) for the selected window, normalized across observations."
                          >
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                              <circle cx="12" cy="12" r="10" />
                              <path d="M12 16v-4M12 8h.01" strokeLinecap="round" />
                            </svg>
                            <span className="sr-only">
                              Instructional drift score for the selected window, normalized across observations.
                            </span>
                          </span>
                        </div>
                      </th>
                      <th className="min-w-[13.5rem] px-4 py-4">
                        <span className="inline-flex flex-col gap-0.5">
                          <span>Signal heatmap</span>
                          <span className="text-[0.625rem] font-normal normal-case tracking-normal text-muted">
                            Higher mean = stronger (1–4)
                          </span>
                        </span>
                      </th>
                      <th className="px-4 py-4">Top drivers</th>
                      <th className="px-4 py-4 text-right">Last observed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedRiskRows.map((row) => {
                      const drift = formatDrift(row.normalizedIDS);
                      const signalDataForHeat = pivotSignalByTeacherId.get(row.teacherMembershipId);
                      return (
                        <ClickableRow
                          key={row.teacherMembershipId}
                          href={`/analysis/teachers/${row.teacherMembershipId}?window=${windowDays}&ref=explorer`}
                          className="group table-row calm-transition cursor-pointer"
                        >
                          <td className="whitespace-nowrap px-5 py-5">
                            <Link
                              href={`/analysis/teachers/${row.teacherMembershipId}?window=${windowDays}&ref=explorer`}
                              className="flex items-center gap-3.5 calm-transition group-hover:text-accent"
                            >
                              <Avatar name={row.teacherName} size="md" />
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-[var(--text)]">{row.teacherName}</p>
                                <p className="truncate text-xs text-muted">Teacher</p>
                              </div>
                            </Link>
                          </td>
                          <td className="whitespace-nowrap px-4 py-5 text-muted">
                            {row.departmentNames.join(", ") || "—"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-5 text-center font-semibold tabular-nums text-[var(--text)]">
                            {zeroPad(row.teacherCoverage)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-5">
                            <StatusPill variant={STATUS_VARIANT[row.status]} size="sm">
                              {STATUS_LABELS[row.status]}
                            </StatusPill>
                          </td>
                          <td className="whitespace-nowrap px-4 py-5 text-center">
                            <span className={`inline-flex items-center gap-1 font-semibold tabular-nums ${drift.color}`}>
                              {drift.text}
                              <span className="text-xs" aria-hidden>
                                {drift.arrow}
                              </span>
                            </span>
                          </td>
                          <td className="min-w-[11rem] px-4 py-5">
                            <SignalHeatmapClient
                              cells={heatmapKeys.map((key) => {
                                const cell = signalDataForHeat?.[key];
                                const mean = cell?.currentMean;
                                return {
                                  key,
                                  barClass: meanToHeatmapBarClass(mean),
                                  label: signalLabelMap[key] ?? key,
                                  mean,
                                  href: `/analysis/teachers/${row.teacherMembershipId}?window=${windowDays}&ref=explorer&signal=${key}#teacher-full-signal-profile`,
                                };
                              })}
                            />
                          </td>
                          <td className="px-4 py-5">
                            <TopDriverLinks
                              drivers={row.topDrivers}
                              labelByKey={signalLabelMap}
                              windowDays={windowDays}
                            />
                          </td>
                          <td className="whitespace-nowrap px-4 py-5 text-right text-muted">
                            {row.lastObservationAt
                              ? new Date(row.lastObservationAt).toLocaleDateString("en-GB", {
                                  day: "numeric",
                                  month: "short",
                                })
                              : "—"}
                          </td>
                        </ClickableRow>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {totalItems > 0 ? (
        <TablePagination
          page={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={ITEMS_PER_PAGE}
          itemLabel="teachers"
          pageHref={pageUrl}
          className="mt-4 rounded-xl border border-border/20 bg-[var(--surface-container-lowest)]"
        />
      ) : null}

    </div>
  );
}
