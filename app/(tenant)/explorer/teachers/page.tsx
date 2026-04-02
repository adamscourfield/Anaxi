import Link from "next/link";
import { ClickableRow } from "@/components/ui/clickable-row";
import { notFound } from "next/navigation";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { canViewExplorer, canExportExplorer } from "@/modules/authz";
import { StatusPill, type PillVariant } from "@/components/ui/status-pill";
import { Avatar } from "@/components/ui/avatar";
import { SIGNAL_DEFINITIONS } from "@/modules/observations/signalDefinitions";
import {
  computeTeacherPivot,
  computeTeacherRiskIndex,
  type RiskStatus,
  type TeacherPivotRow,
  type TeacherRiskRow,
} from "@/modules/analysis/teacherRisk";
import { TopDriverLinks } from "./TopDriverLinks";

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

function meanToBgColor(mean: number): string {
  if (mean >= 3.5) return "bg-scale-strong-bar";
  if (mean >= 2.5) return "bg-scale-some-bar";
  if (mean >= 1.5) return "bg-risk-priority-bg";
  return "bg-scale-limited-bar";
}

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

const VALID_WINDOWS = [7, 21, 28] as const;
type WindowDays = (typeof VALID_WINDOWS)[number];

const SIGNAL_KEYS = SIGNAL_DEFINITIONS.map((s) => s.key);
const SIGNAL_LABEL_MAP: Record<string, string> = Object.fromEntries(
  SIGNAL_DEFINITIONS.map((s) => [s.key, s.displayNameDefault]),
);

/** Signals shown in the compact heatmap (first 6) */
const HEATMAP_KEYS = SIGNAL_KEYS.slice(0, 6);

/** Teachers per page */
const ITEMS_PER_PAGE = 20;

function formatTeacherRole(role: string): string {
  const map: Record<string, string> = {
    SUPER_ADMIN: "Super Admin",
    ADMIN: "Admin",
    SLT: "Senior Leader",
    HOD: "Head of Dept",
    LEADER: "Leader",
    TEACHER: "Teacher",
    HR: "HR",
    ON_CALL: "On Call",
  };
  return map[role] ?? role;
}


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

/* ─── Pagination helpers ──────────────────────────────────────────────────── */

function buildPageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "ellipsis")[] = [];
  pages.push(1);
  if (current > 3) pages.push("ellipsis");
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i);
  }
  if (current < total - 2) pages.push("ellipsis");
  pages.push(total);
  return pages;
}

/* ─── Page ─────────────────────────────────────────────────────────────────── */

export default async function ExplorerTeachersPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
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

  // ─── Parse search params ────────────────────────────────────────────────────
  const rawWindow = Number(
    typeof searchParams?.windowDays === "string" ? searchParams.windowDays : "21",
  );
  const windowDays: WindowDays = VALID_WINDOWS.includes(rawWindow as WindowDays)
    ? (rawWindow as WindowDays)
    : 21;

  const mode =
    typeof searchParams?.mode === "string" && searchParams.mode === "priorities"
      ? "priorities"
      : "pivot";

  const sort =
    typeof searchParams?.sort === "string" &&
    ["drift", "coverage", "name"].includes(searchParams.sort)
      ? (searchParams.sort as "drift" | "coverage" | "name")
      : "drift";

  const dir =
    typeof searchParams?.dir === "string" && ["asc", "desc"].includes(searchParams.dir)
      ? (searchParams.dir as "asc" | "desc")
      : "desc";

  const departmentId =
    typeof searchParams?.departmentId === "string" ? searchParams.departmentId : undefined;

  const rawPage = Number(
    typeof searchParams?.page === "string" ? searchParams.page : "1",
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
    ? departments.filter((d) => hodDepartmentIds.includes(d.id))
    : departments;

  // ─── Fetch data ─────────────────────────────────────────────────────────────
  let pivotRows: TeacherPivotRow[] = [];
  let riskRows: TeacherRiskRow[] = [];

  if (mode === "pivot") {
    const result = await computeTeacherPivot(user.tenantId, windowDays);
    pivotRows = result.rows;
  } else {
    riskRows = await computeTeacherRiskIndex(user.tenantId, windowDays);
  }

  // ─── HOD scope filter ───────────────────────────────────────────────────────
  if (isHod && hodDepartmentIds.length > 0) {
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

  // ─── Sorting (pivot mode) ──────────────────────────────────────────────────
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

  const pageNumbers = buildPageNumbers(currentPage, totalPages);

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

      {/* ── Page header ────────────────────────────────────────────────────── */}
      <div className="mb-8 flex items-start justify-between">
        <h1 className="font-sans text-[2.25rem] font-bold leading-tight tracking-[-0.02em] text-text">
          Teachers
        </h1>
        {canExport && (
          <form action="/api/explorer/export" method="POST">
            <input
              type="hidden"
              name="view"
              value={mode === "pivot" ? "INSTRUCTION_TEACHERS_PIVOT" : "TEACHER_PRIORITIES"}
            />
            <input type="hidden" name="windowDays" value={String(windowDays)} />
            {departmentId && <input type="hidden" name="departmentId" value={departmentId} />}
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-[0.8125rem] font-semibold text-on-primary calm-transition hover:bg-primary-container"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="7 10 12 15 17 10" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="12" y1="15" x2="12" y2="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Export CSV
            </button>
          </form>
        )}
      </div>

      {/* ── Controls bar ────────────────────────────────────────────────────── */}
      <div className="mb-6 filter-bar">
        {/* Window selector */}
        <div className="filter-period-toggle">
          {VALID_WINDOWS.map((w) => (
            <Link
              key={w}
              href={buildUrl({ windowDays: String(w), page: "1" })}
              className={`filter-period-btn ${w === windowDays ? "filter-period-btn-active" : ""}`}
            >
              {w}D
            </Link>
          ))}
        </div>

        {/* Mode toggle */}
        <div className="filter-period-toggle">
          <Link
            href={buildUrl({ mode: "pivot", page: "1" })}
            className={`filter-period-btn ${mode === "pivot" ? "filter-period-btn-active" : ""}`}
          >
            Performance view
          </Link>
          <Link
            href={buildUrl({ mode: "priorities", page: "1" })}
            className={`filter-period-btn ${mode === "priorities" ? "filter-period-btn-active" : ""}`}
          >
            Priority view
          </Link>
        </div>

        {/* Department filter */}
        <form className="flex items-center gap-2" method="GET" action="/explorer/teachers">
          <input type="hidden" name="windowDays" value={String(windowDays)} />
          <input type="hidden" name="mode" value={mode} />
          <input type="hidden" name="sort" value={sort} />
          <input type="hidden" name="dir" value={dir} />
          <input type="hidden" name="page" value="1" />
          <select
            name="departmentId"
            defaultValue={departmentId ?? ""}
            className="field min-w-[160px] !rounded-lg !py-1.5 !text-[0.8125rem]"
          >
            <option value="">All Departments</option>
            {scopedDepartments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-lg bg-primary px-4 py-1.5 text-[0.8125rem] font-semibold text-on-primary calm-transition hover:opacity-90"
          >
            Apply
          </button>
          {departmentId && (
            <Link
              href={buildUrl({ departmentId: "", page: "1" })}
              className="rounded-lg border border-border/40 bg-surface-container-lowest px-4 py-1.5 text-[0.8125rem] font-medium text-muted calm-transition hover:bg-surface-container-low hover:text-text"
            >
              Clear
            </Link>
          )}
        </form>
      </div>

      {/* ── Performance view (pivot) ────────────────────────────────────────── */}
      {mode === "pivot" && (
        <>
          {pivotRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
                <svg className="h-6 w-6 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                </svg>
              </div>
              <p className="text-[0.875rem] font-semibold text-text">No teachers found</p>
              <p className="mt-1 text-[0.8125rem] text-muted">Try adjusting the window or department filter.</p>
            </div>
          ) : (
            <div className="table-shell">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="table-head-row">
                      <th className="px-5 py-3.5">
                        <Link href={sortUrl("name")} className="calm-transition hover:text-text">
                          Teacher{sortIndicator("name")}
                        </Link>
                      </th>
                      <th className="px-4 py-3.5">Department</th>
                      <th className="px-4 py-3.5 text-center">
                        <Link href={sortUrl("coverage")} className="calm-transition hover:text-text">
                          Coverage{sortIndicator("coverage")}
                        </Link>
                      </th>
                      <th className="px-4 py-3.5">Status</th>
                      <th className="px-4 py-3.5 text-center">
                        <Link href={sortUrl("drift")} className="calm-transition hover:text-text">
                          Drift Score{sortIndicator("drift")}
                        </Link>
                      </th>
                      <th className="px-4 py-3.5">Signal Heatmap</th>
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
                          <td className="whitespace-nowrap px-5 py-4">
                            <Link
                              href={`/analysis/teachers/${row.teacherMembershipId}?window=${windowDays}`}
                              className="flex items-center gap-3 calm-transition group-hover:text-accent"
                            >
                              <Avatar name={row.teacherName} size="md" />
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-text">{row.teacherName}</p>
                                <p className="truncate text-xs text-muted">{formatTeacherRole(row.teacherRole)}</p>
                              </div>
                            </Link>
                          </td>

                          {/* Department */}
                          <td className="whitespace-nowrap px-4 py-4 text-muted">
                            {row.departmentNames.join(", ") || "—"}
                          </td>

                          {/* Coverage (zero-padded) */}
                          <td className="whitespace-nowrap px-4 py-4 text-center font-semibold tabular-nums text-text">
                            {zeroPad(row.teacherCoverage)}
                          </td>

                          {/* Status */}
                          <td className="whitespace-nowrap px-4 py-4">
                            <StatusPill variant={STATUS_VARIANT[row.status]} size="sm">
                              {STATUS_LABELS[row.status]}
                            </StatusPill>
                          </td>

                          {/* Drift Score */}
                          <td className="whitespace-nowrap px-4 py-4 text-center">
                            <span className={`inline-flex items-center gap-1 font-semibold tabular-nums ${drift.color}`}>
                              {drift.text}
                              <span className="text-xs">{drift.arrow}</span>
                            </span>
                          </td>

                          {/* Signal Heatmap */}
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-1">
                              {HEATMAP_KEYS.map((key) => {
                                const cell = row.signalData[key];
                                const mean = cell?.currentMean;
                                const bg = mean != null ? meanToBgColor(mean) : "bg-surface-container-high";
                                const label = SIGNAL_LABEL_MAP[key] ?? key;
                                return (
                                  <div
                                    key={key}
                                    className={`h-6 w-6 rounded-sm ${bg}`}
                                    title={`${label}: ${mean != null ? mean.toFixed(2) : "N/A"}`}
                                  />
                                );
                              })}
                            </div>
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
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
                <svg className="h-6 w-6 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                </svg>
              </div>
              <p className="text-[0.875rem] font-semibold text-text">No teachers found</p>
              <p className="mt-1 text-[0.8125rem] text-muted">Try adjusting the window or department filter.</p>
            </div>
          ) : (
            <div className="table-shell">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="table-head-row">
                      <th className="px-5 py-3.5">
                        <Link href={sortUrl("name")} className="calm-transition hover:text-text">
                          Teacher{sortIndicator("name")}
                        </Link>
                      </th>
                      <th className="px-4 py-3.5">Department</th>
                      <th className="px-4 py-3.5 text-center">
                        <Link href={sortUrl("coverage")} className="calm-transition hover:text-text">
                          Coverage{sortIndicator("coverage")}
                        </Link>
                      </th>
                      <th className="px-4 py-3.5">Status</th>
                      <th className="px-4 py-3.5 text-center">
                        <Link href={sortUrl("drift")} className="calm-transition hover:text-text">
                          Drift Score{sortIndicator("drift")}
                        </Link>
                      </th>
                      <th className="px-4 py-3.5">Top Drivers</th>
                      <th className="px-4 py-3.5 text-right">Last Observed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedRiskRows.map((row) => {
                      const drift = formatDrift(row.normalizedIDS);
                      return (
                        <ClickableRow
                          key={row.teacherMembershipId}
                          href={`/analysis/teachers/${row.teacherMembershipId}?window=${windowDays}`}
                          className="group table-row calm-transition cursor-pointer"
                        >
                          <td className="whitespace-nowrap px-5 py-4">
                            <Link
                              href={`/analysis/teachers/${row.teacherMembershipId}?window=${windowDays}`}
                              className="flex items-center gap-3 calm-transition group-hover:text-accent"
                            >
                              <Avatar name={row.teacherName} size="md" />
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-text">{row.teacherName}</p>
                                <p className="truncate text-xs text-muted">{formatTeacherRole(row.teacherRole)}</p>
                              </div>
                            </Link>
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-muted">
                            {row.departmentNames.join(", ") || "—"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-center font-semibold tabular-nums text-text">
                            {zeroPad(row.teacherCoverage)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4">
                            <StatusPill variant={STATUS_VARIANT[row.status]} size="sm">
                              {STATUS_LABELS[row.status]}
                            </StatusPill>
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-center">
                            <span className={`inline-flex items-center gap-1 font-semibold tabular-nums ${drift.color}`}>
                              {drift.text}
                              <span className="text-xs">{drift.arrow}</span>
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <TopDriverLinks
                              drivers={row.topDrivers}
                              labelByKey={SIGNAL_LABEL_MAP}
                              windowDays={windowDays}
                            />
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-right text-muted">
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

      {/* ── Pagination ──────────────────────────────────────────────────────── */}
      {totalItems > 0 && (
        <div className="mt-4 flex items-center justify-between rounded-xl bg-surface/60 px-5 py-3">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
            Showing {startIdx + 1}-{endIdx} of {totalItems} teachers
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              {/* Previous */}
              {currentPage > 1 ? (
                <Link
                  href={pageUrl(currentPage - 1)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted calm-transition hover:text-text"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              ) : (
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-border">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              )}

              {/* Page numbers */}
              {pageNumbers.map((p, idx) =>
                p === "ellipsis" ? (
                  <span key={`ellipsis-${idx}`} className="px-1 text-sm text-muted">
                    …
                  </span>
                ) : (
                  <Link
                    key={p}
                    href={pageUrl(p)}
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium calm-transition ${
                      p === currentPage
                        ? "font-bold text-text underline underline-offset-4"
                        : "text-muted hover:text-text"
                    }`}
                  >
                    {p}
                  </Link>
                ),
              )}

              {/* Next */}
              {currentPage < totalPages ? (
                <Link
                  href={pageUrl(currentPage + 1)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted calm-transition hover:text-text"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              ) : (
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-border">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              )}
            </div>
          )}
        </div>
      )}

    </>
  );
}
