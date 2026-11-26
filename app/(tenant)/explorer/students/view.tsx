import styles from "./students.module.css";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { getSessionUserOrThrow } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireFeature } from "@/lib/guards";
import { hasPermission } from "@/lib/rbac";
import { buildViewerContext } from "@/lib/viewerContext";
import { parseWindow } from "@/lib/explorerUtils";
import {
  canViewExplorer,
  canExportExplorer,
  canViewBehaviourExplorer,
  canViewStudentAnalysis,
} from "@/modules/authz";
import { computeStudentRiskIndex } from "@/modules/analysis/studentRisk";
import {
  buildActiveChips,
  buildStudentsListUrl,
  countBands,
  DEFAULT_VIEW_MODE,
  filterStudentRows,
  getPageSize,
  parseSortMode,
  parseStatusFilter,
  parseViewMode,
  type StudentsListFilters,
  type StudentsUrlParams,
} from "@/modules/students/explorerList";
import { StudentsToolbar } from "./StudentsToolbar";
import { StudentsKpiStrip } from "./StudentsKpiStrip";
import { StudentsBandChips } from "./StudentsBandChips";
import { StudentsCriticalBanner } from "./StudentsCriticalBanner";
import { StudentsListSection } from "./StudentsListSection";
import { TablePagination } from "@/components/ui/table-pagination";
import { studentAvatarUrlFor } from "@/lib/avatarUpload";

const BASE_PATH = "/students";

function firstParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const v = params[key];
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ANALYSIS");

  const viewerContext = await buildViewerContext(user);

  if (
    !canViewExplorer(viewerContext) ||
    !canViewBehaviourExplorer(viewerContext) ||
    !canViewStudentAnalysis(viewerContext)
  ) {
    notFound();
  }

  const windowDays = parseWindow(firstParam(params, "windowDays"));
  const yearGroupFilter = firstParam(params, "yearGroup");
  const studentSearch = firstParam(params, "studentSearch");
  const bandFilter = firstParam(params, "band");
  const sendFilter = firstParam(params, "send");
  const ppFilter = firstParam(params, "pp");
  const confidenceFilter = firstParam(params, "confidence");
  const watchlistFilter = firstParam(params, "watchlist") === "1";
  const attendanceBelow = firstParam(params, "attendanceBelow") === "1";
  const viewMode = parseViewMode(firstParam(params, "view"), bandFilter);
  const canManageStudents = hasPermission(user.role, "students:write");
  const statusFilter = canManageStudents ? parseStatusFilter(firstParam(params, "status")) : "active";
  const sortMode = parseSortMode(firstParam(params, "sort"));
  const hasExplicitParams =
    firstParam(params, "view") ||
    bandFilter ||
    yearGroupFilter ||
    studentSearch ||
    sendFilter ||
    ppFilter ||
    confidenceFilter ||
    watchlistFilter ||
    attendanceBelow ||
    firstParam(params, "page");

  const effectiveView =
    !hasExplicitParams && viewMode === DEFAULT_VIEW_MODE
      ? DEFAULT_VIEW_MODE
      : viewMode;

  const currentPage = Math.max(1, Number(firstParam(params, "page")) || 1);

  const { rows: allRows, computedAt } = await computeStudentRiskIndex(
    user.tenantId,
    windowDays,
    user.id,
    statusFilter === "archived" ? "ARCHIVED" : statusFilter === "all" ? "ALL" : "ACTIVE",
  );

  // Headline KPIs always summarise the live (active) cohort, even when browsing
  // archived students -- when the list itself excludes active students, fetch
  // them separately so the KPI strip doesn't read as "no data".
  const activeRows =
    statusFilter === "archived"
      ? (await computeStudentRiskIndex(user.tenantId, windowDays, user.id, "ACTIVE")).rows
      : allRows.filter((r) => r.status === "ACTIVE");

  const yearGroups = Array.from(
    new Set(allRows.map((r) => r.yearGroup).filter(Boolean)),
  ).sort() as string[];

  const filters: StudentsListFilters = {
    view: effectiveView,
    band: bandFilter,
    yearGroup: yearGroupFilter,
    studentSearch,
    send: sendFilter,
    pp: ppFilter,
    confidence: confidenceFilter,
    watchlistOnly: watchlistFilter,
    attendanceBelow80: attendanceBelow,
    sort: sortMode,
  };

  const rows = filterStudentRows(allRows, filters);
  const bandCounts = countBands(statusFilter === "archived" ? activeRows : allRows);

  const urlBase: StudentsUrlParams = {
    windowDays,
    view: effectiveView !== DEFAULT_VIEW_MODE ? effectiveView : undefined,
    band: bandFilter || undefined,
    yearGroup: yearGroupFilter || undefined,
    studentSearch: studentSearch || undefined,
    send: sendFilter || undefined,
    pp: ppFilter || undefined,
    confidence: confidenceFilter || undefined,
    watchlist: watchlistFilter ? "1" : undefined,
    attendanceBelow: attendanceBelow ? "1" : undefined,
    status: statusFilter,
    sort: sortMode,
  };

  const listPath = buildStudentsListUrl(BASE_PATH, urlBase);
  const activeChips = buildActiveChips(BASE_PATH, urlBase, filters);

  const totalFiltered = rows.length;
  const perPage = getPageSize(effectiveView, bandFilter, totalFiltered);
  const totalPages = Math.max(1, Math.ceil(totalFiltered / perPage));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * perPage;
  const pageEnd = Math.min(pageStart + perPage, totalFiltered);
  const pageRows = rows.slice(pageStart, pageEnd);
  const visibleStudentAvatars = pageRows.length
    ? await (prisma as any).student.findMany({
      where: { tenantId: user.tenantId, id: { in: pageRows.map((row) => row.studentId) } },
      select: { id: true, avatarUpdatedAt: true },
    })
    : [];
  const studentAvatarUrlById = new Map<string, string | null>(
    visibleStudentAvatars.map((student: { id: string; avatarUpdatedAt: Date | null }) => [student.id, studentAvatarUrlFor(student.id, student.avatarUpdatedAt)]),
  );
  const pageRowsWithAvatars = pageRows.map((row) => ({ ...row, avatarUrl: studentAvatarUrlById.get(row.studentId) ?? null }));

  // Average only over students who have attendance recorded. Counting the rest as 0% (and dividing by
  // everyone) dragged the figure down whenever data was incomplete, and showed "0.0%" when there was none.
  const withAttendance = activeRows.filter((r) => r.attendancePct !== null);
  const avgAttendance =
    withAttendance.length > 0
      ? withAttendance.reduce((sum, r) => sum + (r.attendancePct ?? 0), 0) / withAttendance.length
      : null;
  const priorityCount = bandCounts.PRIORITY + bandCounts.URGENT;
  const lowAttendanceCount = activeRows.filter(
    (r) => r.attendancePct !== null && r.attendancePct < 80,
  ).length;

  const showExport = canExportExplorer(viewerContext);
  const showBehaviourColumns =
    effectiveView === "attention" ||
    bandFilter === "URGENT" ||
    bandFilter === "PRIORITY" ||
    pageRows.some((r) => r.band === "URGENT" || r.band === "PRIORITY");

  function pageUrl(p: number): string {
    return buildStudentsListUrl(BASE_PATH, { ...urlBase, page: p > 1 ? p : undefined });
  }

  const pagination = (
    // Keyed: it is passed into the client list and rendered alongside other children there.
    <TablePagination
      key="pagination"
      page={safePage}
      totalPages={totalPages}
      totalItems={totalFiltered}
      pageSize={perPage}
      itemLabel="students"
      pageHrefBase={pageUrl(1)}
    />
  );

  return (
    <div className={styles.page}>
      <PageHeader
        variant="ledger"
        className={styles.header}
        title="Student directory"
        subtitle="Find student records, manage their status and open their profiles."
        actions={
          showExport ? (
            <form action="/api/explorer/export" method="POST" className="inline">
              <input type="hidden" name="view" value="BEHAVIOUR_STUDENTS_TABLE" />
              <input type="hidden" name="windowDays" value={String(windowDays)} />
              {Object.entries(urlBase).filter(([key])=>key!=="windowDays" && key!=="view").map(([key,v])=><input key={key} type="hidden" name={key==="view"?"listView":key} value={String(v??"")}/>)}
              <input type="hidden" name="listView" value={effectiveView} />
              <button type="submit" className="anx-btn-pill-ghost calm-transition font-semibold">
                Export CSV
              </button>
            </form>
          ) : undefined
        }
      />

      <StudentsKpiStrip
        basePath={BASE_PATH}
        urlBase={urlBase}
        cohortCount={activeRows.length}
        avgAttendance={avgAttendance}
        priorityCount={priorityCount}
        lowAttendanceCount={lowAttendanceCount}
        windowDays={windowDays}
      />

      <StudentsCriticalBanner
        basePath={BASE_PATH}
        urlBase={urlBase}
        priorityCount={priorityCount}
        windowDays={windowDays}
        computedAt={computedAt}
      />

      <section className={styles.directory} aria-label="Student records">
      <div className={styles.listHeading}><div><h2>{statusFilter === "archived" ? "Archived students" : effectiveView === "attention" ? "Students needing attention" : "All students"}</h2></div><span className={styles.resultCount}>{totalFiltered.toLocaleString("en-GB")} {totalFiltered === 1 ? "student" : "students"}</span></div>

      <section className={styles.filters} aria-label="Find students">
      <StudentsBandChips
        basePath={BASE_PATH}
        urlBase={urlBase}
        bandCounts={bandCounts}
        activeBand={bandFilter}
        activeView={effectiveView}
      />

      <StudentsToolbar
        basePath={BASE_PATH}
        yearGroups={yearGroups}
        urlBase={urlBase}
        activeChips={activeChips}
        canManageStudents={canManageStudents}
      />

      </section>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16">
          <p className="text-[0.875rem] font-semibold text-text">
            {allRows.length === 0 ? "No student data" : "No matches"}
          </p>
          <p className="mt-1 text-[0.8125rem] text-muted">
          {allRows.length === 0
              ? "Try widening the window period or adjusting your filters."
              : "Try adjusting your filters."}
          </p>
          {activeChips.length > 0 && (
            <Link href={buildStudentsListUrl(BASE_PATH, { windowDays })} className="mt-4 link-accent text-sm">
              Clear all filters
            </Link>
          )}
        </div>
      ) : (
        <StudentsListSection
          pageRows={pageRowsWithAvatars}
          windowDays={windowDays}
          listPath={listPath}
          showBehaviourColumns={showBehaviourColumns}
          pageStart={pageStart}
          pageEnd={pageEnd}
          totalFiltered={totalFiltered}
          pagination={pagination}
          canManageStudents={canManageStudents}
          showStatusColumn={statusFilter === "all"}
        />
      )}

      </section>

      <p className="text-[0.75rem] text-muted">
        Based on the last {windowDays} days. Worked out{" "}
        {computedAt.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Europe/London" })}.
      </p>
    </div>
  );
}
