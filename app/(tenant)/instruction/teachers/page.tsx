import Link from "next/link";
import { ClickableRow } from "@/components/ui/clickable-row";
import { PageHeader } from "@/components/ui/page-header";
import { ExplorerBackLink } from "@/components/explorer/explorer-chrome";
import { notFound } from "next/navigation";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { canAccessTeacherDirectory } from "@/lib/analysisNav";
import { canExportExplorer, canViewTeacherAnalysis } from "@/modules/authz";
import { getSignalDefinitionsForSchoolType } from "@/modules/observations/getSignalsBySchoolType";
import {
  computeTeacherPivot,
  computeTeacherRiskIndex,
  type RiskStatus,
  type TeacherPivotRow,
  type TeacherRiskRow,
} from "@/modules/analysis/teacherRisk";
import { TeachersFilterToolbar } from "@/components/teachers/TeachersFilterToolbar";
import { TopDriverLinks } from "@/app/(tenant)/explorer/teachers/TopDriverLinks";
import { meanToHeatmapBarClass, signalHeatmapCellTitle } from "@/lib/analysis/signalHeatmap";
import { StatusPill, type PillVariant } from "@/components/ui/status-pill";
import { Avatar } from "@/components/ui/avatar";

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

const VALID_WINDOWS = [7, 21, 28, 90] as const;
type WindowDays = (typeof VALID_WINDOWS)[number];

const ITEMS_PER_PAGE = 20;

function formatDrift(value: number): { text: string; arrow: string; color: string } {
  const abs = Math.abs(value);
  const formatted = abs.toFixed(1);
  if (value > 0.5) return { text: `+${formatted}`, arrow: "↗", color: "text-scale-strong-text" };
  if (value < -0.5) return { text: `-${formatted}`, arrow: "↘", color: "text-scale-limited-text" };
  const sign = value < 0 ? "-" : "+";
  return { text: `${sign}${formatted}`, arrow: "→", color: "text-muted" };
}

function zeroPad(n: number): string {
  return String(n).padStart(2, "0");
}

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

async function resolvePivotTeacherFilter(args: {
  tenantId: string;
  role: string;
  userId: string;
  hodDepartmentIds: string[];
  coacheeUserIds: string[];
}): Promise<string[] | undefined> {
  const { tenantId, role, userId, hodDepartmentIds, coacheeUserIds } = args;

  if (role === "TEACHER") return [userId];

  if (role === "LEADER") {
    return coacheeUserIds.length > 0 ? coacheeUserIds : [];
  }

  if (role === "HOD") {
    if (hodDepartmentIds.length === 0) return [];
    const memberRows = await (prisma as any).departmentMembership.findMany({
      where: { tenantId, departmentId: { in: hodDepartmentIds } },
      select: { userId: true },
    });
    return [...new Set((memberRows as { userId: string }[]).map((m) => m.userId))];
  }

  return undefined;
}

export default async function InstructionTeachersPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ANALYSIS");

  const [hodMemberships, coachAssignments] = await Promise.all([
    (prisma as any).departmentMembership.findMany({
      where: { userId: user.id, isHeadOfDepartment: true },
    }),
    (prisma as any).coachAssignment.findMany({ where: { coachUserId: user.id } }),
  ]);

  const hodDepartmentIds = (hodMemberships as any[]).map((m: any) => m.departmentId);
  const coacheeUserIds = (coachAssignments as any[]).map((a: any) => a.coacheeUserId);

  if (!canAccessTeacherDirectory(user.role, coacheeUserIds.length)) notFound();

  const viewerContext = { userId: user.id, role: user.role, hodDepartmentIds, coacheeUserIds };

  const settings = await (prisma as any).tenantSettings.findUnique({ where: { tenantId: user.tenantId } });
  const schoolType = settings?.schoolType ?? "SECONDARY";
  const signalDefs = getSignalDefinitionsForSchoolType(schoolType);
  const signalLabelMap: Record<string, string> = Object.fromEntries(
    signalDefs.map((s) => [s.key, s.displayNameDefault]),
  );
  const heatmapKeys = signalDefs.map((s) => s.key).slice(0, 6);

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

  const rawPage = Number(typeof searchParams?.page === "string" ? searchParams.page : "1");
  const page = rawPage >= 1 ? Math.floor(rawPage) : 1;

  const departments: { id: string; name: string }[] = await (prisma as any).department.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const isHod = user.role === "HOD";
  const scopedDepartments = isHod
    ? departments.filter((d) => hodDepartmentIds.includes(d.id))
    : departments;

  const teacherFilter = await resolvePivotTeacherFilter({
    tenantId: user.tenantId,
    role: user.role,
    userId: user.id,
    hodDepartmentIds,
    coacheeUserIds,
  });

  const pivotFilter =
    teacherFilter === undefined ? undefined : teacherFilter.length > 0 ? teacherFilter : ([] as string[]);

  const deptMemberships = await (prisma as any).departmentMembership.findMany({
    where: { tenantId: user.tenantId },
    select: { userId: true, departmentId: true },
  });
  const teacherDeptIds = new Map<string, string[]>();
  for (const m of deptMemberships as { userId: string; departmentId: string }[]) {
    if (!teacherDeptIds.has(m.userId)) teacherDeptIds.set(m.userId, []);
    teacherDeptIds.get(m.userId)!.push(m.departmentId);
  }

  let pivotRows: TeacherPivotRow[] = [];
  let riskRows: TeacherRiskRow[] = [];

  if (mode === "pivot") {
    const result = await computeTeacherPivot(user.tenantId, windowDays, pivotFilter);
    pivotRows = result.rows;
  } else {
    riskRows = await computeTeacherRiskIndex(user.tenantId, windowDays);
  }

  if (isHod && hodDepartmentIds.length > 0) {
    const hodDeptNameSet = new Set(scopedDepartments.map((d) => d.name));
    if (mode === "pivot") {
      pivotRows = pivotRows.filter((r) => r.departmentNames.some((dn) => hodDeptNameSet.has(dn)));
    } else {
      riskRows = riskRows.filter((r) => r.departmentNames.some((dn) => hodDeptNameSet.has(dn)));
    }
  }

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

  function filterByVisibility<T extends { teacherMembershipId: string }>(rows: T[]): T[] {
    return rows.filter((r) =>
      canViewTeacherAnalysis(viewerContext, {
        teacherUserId: r.teacherMembershipId,
        teacherDepartmentIds: teacherDeptIds.get(r.teacherMembershipId) ?? [],
      }),
    );
  }

  pivotRows = filterByVisibility(pivotRows);
  riskRows = filterByVisibility(riskRows);

  if (mode === "pivot") {
    const multiplier = dir === "asc" ? 1 : -1;
    pivotRows.sort((a, b) => {
      if (sort === "drift") return (a.normalizedIDS - b.normalizedIDS) * multiplier;
      if (sort === "coverage") return (a.teacherCoverage - b.teacherCoverage) * multiplier;
      return a.teacherName.localeCompare(b.teacherName) * multiplier;
    });
  }

  if (mode === "priorities") {
    const multiplier = dir === "asc" ? 1 : -1;
    riskRows.sort((a, b) => {
      if (sort === "drift") return (a.normalizedIDS - b.normalizedIDS) * multiplier;
      if (sort === "coverage") return (a.teacherCoverage - b.teacherCoverage) * multiplier;
      return a.teacherName.localeCompare(b.teacherName) * multiplier;
    });
  }

  const canExport = canExportExplorer(viewerContext);

  const allRows = mode === "pivot" ? pivotRows : riskRows;
  const totalItems = allRows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIdx = Math.min(startIdx + ITEMS_PER_PAGE, totalItems);

  const pagedPivotRows = mode === "pivot" ? pivotRows.slice(startIdx, endIdx) : [];
  const pagedRiskRows = mode === "priorities" ? riskRows.slice(startIdx, endIdx) : [];

  const pageNumbers = buildPageNumbers(currentPage, totalPages);

  function buildUrl(overrides: Record<string, string>) {
    const base: Record<string, string> = {
      windowDays: String(windowDays),
      mode,
      sort,
      dir,
    };
    if (departmentId) base.departmentId = departmentId;
    const merged = { ...base, ...overrides };
    for (const key of Object.keys(merged)) {
      if (!merged[key]) delete merged[key];
    }
    const qs = new URLSearchParams(merged).toString();
    return `/instruction/teachers?${qs}`;
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

  return (
    <div className="space-y-6 pb-10">
      <ExplorerBackLink />

      <PageHeader
        variant="ledger"
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

      <TeachersFilterToolbar
        variant="instruction"
        windowDays={windowDays}
        mode={mode}
        sort={sort}
        dir={dir}
        departmentId={departmentId}
        scopedDepartments={scopedDepartments}
        buildUrl={buildUrl}
      />

      {mode === "pivot" && (
        <>
          {pivotRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-md bg-accent/10">
                <svg className="h-6 w-6 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 0 1 5.25 0 2.625 2.625 0 0 1-5.25 0Z" />
                </svg>
              </div>
              <p className="text-[0.875rem] font-semibold text-text">No teachers in scope</p>
              <p className="mt-1 max-w-md text-center text-[0.8125rem] text-muted">
                {user.role === "LEADER"
                  ? "You do not have coaching assignments, or no observations exist for your coachees in this window."
                  : "Try a longer window, or check department assignments if you are a head of department."}
              </p>
            </div>
          ) : (
            <div className="table-shell">
              <p className="sr-only" id="instruction-teachers-pivot-scroll-hint">
                This table scrolls horizontally on small screens. Use touch or trackpad to see all columns.
              </p>
              <div className="overflow-x-auto" aria-describedby="instruction-teachers-pivot-scroll-hint">
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
                        <tr key={row.teacherMembershipId} className="group table-row calm-transition">
                          <td className="whitespace-nowrap px-5 py-5">
                            <Link
                              href={`/analysis/teachers/${row.teacherMembershipId}?window=${windowDays}&ref=instruction`}
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
                            <div className="flex flex-wrap items-center gap-1.5">
                              {heatmapKeys.map((key) => {
                                const cell = row.signalData[key];
                                const mean = cell?.currentMean;
                                const barClass = meanToHeatmapBarClass(mean);
                                const label = signalLabelMap[key] ?? key;
                                return (
                                  <div
                                    key={key}
                                    className={`h-5 w-5 shrink-0 rounded-md ${barClass}`}
                                    title={signalHeatmapCellTitle(label, mean)}
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

      {mode === "priorities" && (
        <>
          {riskRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-md bg-accent/10">
                <svg className="h-6 w-6 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 0 1 5.25 0 2.625 2.625 0 0 1-5.25 0Z" />
                </svg>
              </div>
              <p className="text-[0.875rem] font-semibold text-text">No teachers in scope</p>
              <p className="mt-1 max-w-md text-center text-[0.8125rem] text-muted">
                {user.role === "LEADER"
                  ? "You do not have coaching assignments, or no observations exist for your coachees in this window."
                  : "Try a longer window, or check department assignments if you are a head of department."}
              </p>
            </div>
          ) : (
            <div className="table-shell">
              <p className="sr-only" id="instruction-teachers-priorities-scroll-hint">
                This table scrolls horizontally on small screens. Use touch or trackpad to see all columns.
              </p>
              <div className="overflow-x-auto" aria-describedby="instruction-teachers-priorities-scroll-hint">
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
                      <th className="px-4 py-4">Top drivers</th>
                      <th className="px-4 py-4 text-right">Last observed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedRiskRows.map((row) => {
                      const drift = formatDrift(row.normalizedIDS);
                      return (
                        <ClickableRow
                          key={row.teacherMembershipId}
                          href={`/analysis/teachers/${row.teacherMembershipId}?window=${windowDays}&ref=instruction`}
                          className="group table-row calm-transition cursor-pointer"
                        >
                          <td className="whitespace-nowrap px-5 py-5">
                            <Link
                              href={`/analysis/teachers/${row.teacherMembershipId}?window=${windowDays}&ref=instruction`}
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

      {totalItems > 0 && (
        <div className="mt-4 flex items-center justify-between rounded-xl bg-surface/60 px-5 py-3">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
            Showing {startIdx + 1}-{endIdx} of {totalItems} teachers
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
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

              {pageNumbers.map((p, idx) => {
                if (p === "ellipsis") {
                  return (
                    <span key={`ellipsis-${idx}`} className="px-1 text-sm text-muted">
                      …
                    </span>
                  );
                }

                return (
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
                );
              })}

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
    </div>
  );
}
