import styles from "@/app/(tenant)/explorer/students/students.module.css";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { parseWindow } from "@/lib/explorerUtils";
import { computeStudentRiskIndex } from "@/modules/analysis/studentRisk";
import { getTeacherStudentIds } from "@/modules/students/teacherScope";
import {
  buildActiveChips,
  buildStudentsListUrl,
  countBands,
  DEFAULT_VIEW_MODE,
  filterStudentRows,
  getPageSize,
  parseSortMode,
  parseViewMode,
  type StudentsListFilters,
  type StudentsUrlParams,
} from "@/modules/students/explorerList";
import { StudentsToolbar } from "@/app/(tenant)/explorer/students/StudentsToolbar";
import { StudentsKpiStrip } from "@/app/(tenant)/explorer/students/StudentsKpiStrip";
import { StudentsBandChips } from "@/app/(tenant)/explorer/students/StudentsBandChips";
import { StudentsCriticalBanner } from "@/app/(tenant)/explorer/students/StudentsCriticalBanner";
import { StudentsListSection } from "@/app/(tenant)/explorer/students/StudentsListSection";
import { TablePagination } from "@/components/ui/table-pagination";
import { prisma } from "@/lib/prisma";
import { studentAvatarUrlFor } from "@/lib/avatarUpload";

const BASE_PATH = "/students/my";

function firstParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const v = params[key];
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export default async function MyStudentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "STUDENTS");

  if (user.role !== "TEACHER" && user.role !== "LEADER" && user.role !== "SUPPORT") {
    redirect("/students");
  }

  const params = await searchParams;
  const windowDays = parseWindow(firstParam(params, "windowDays"));
  const yearGroupFilter = firstParam(params, "yearGroup");
  const studentSearch = firstParam(params, "studentSearch");
  const bandFilter = firstParam(params, "band");
  const sendFilter = firstParam(params, "send");
  const ppFilter = firstParam(params, "pp");
  const watchlistFilter = firstParam(params, "watchlist") === "1";
  const confidenceFilter = firstParam(params, "confidence");
  const sortMode = parseSortMode(firstParam(params, "sort"));
  const attendanceBelow = firstParam(params, "attendanceBelow") === "1";
  const viewMode = parseViewMode(firstParam(params, "view"), bandFilter);
  const currentPage = Math.max(1, Number(firstParam(params, "page")) || 1);

  const myStudentIds = await getTeacherStudentIds(user.tenantId, user.id);

  if (myStudentIds.size === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          variant="ledger"
          title="My students"
          subtitle="Students linked to your classes appear here once subject-teacher assignments are imported."
        />
        <p className="text-sm text-muted">
          <Link href="/assessments" className="link-accent">
            Open attainment
          </Link>{" "}
          to review attainment for your classes.
        </p>
      </div>
    );
  }

  const { rows: allRiskRows, computedAt } = await computeStudentRiskIndex(
    user.tenantId,
    windowDays,
    user.id,
  );
  const allRows = allRiskRows.filter((r) => myStudentIds.has(r.studentId));

  const yearGroups = Array.from(
    new Set(allRows.map((r) => r.yearGroup).filter(Boolean)),
  ).sort() as string[];

  const filters: StudentsListFilters = {
    view: viewMode,
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
  const bandCounts = countBands(allRows);

  const urlBase: StudentsUrlParams = {
    windowDays,
    view: viewMode !== DEFAULT_VIEW_MODE ? viewMode : undefined,
    band: bandFilter || undefined,
    yearGroup: yearGroupFilter || undefined,
    studentSearch: studentSearch || undefined,
    send: sendFilter || undefined,
    pp: ppFilter || undefined,
    watchlist: watchlistFilter ? "1" : undefined,
    attendanceBelow: attendanceBelow ? "1" : undefined,
    confidence: confidenceFilter || undefined,
    sort: sortMode,
    scope: "my",
  };

  const listPath = buildStudentsListUrl(BASE_PATH, urlBase);
  const activeChips = buildActiveChips(BASE_PATH, urlBase, filters);

  const totalFiltered = rows.length;
  const perPage = getPageSize(viewMode, bandFilter, totalFiltered);
  const totalPages = Math.max(1, Math.ceil(totalFiltered / perPage));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * perPage;
  const pageEnd = Math.min(pageStart + perPage, totalFiltered);
  const pageRowsRaw = rows.slice(pageStart, pageEnd);
  const avatarRows = pageRowsRaw.length
    ? await (prisma as any).student.findMany({
        where: { tenantId: user.tenantId, id: { in: pageRowsRaw.map((row) => row.studentId) } },
        select: { id: true, avatarUpdatedAt: true },
      })
    : [];
  const avatarById = new Map<string, string | null>(
    avatarRows.map((s: { id: string; avatarUpdatedAt: Date | null }) => [s.id, studentAvatarUrlFor(s.id, s.avatarUpdatedAt)]),
  );
  const pageRows = pageRowsRaw.map((row) => ({ ...row, avatarUrl: avatarById.get(row.studentId) ?? null }));

  // Average only over students who have attendance recorded. Counting the rest as 0% (and dividing by
  // everyone) dragged the figure down whenever data was incomplete, and showed "0.0%" when there was none.
  const withAttendance = allRows.filter((r) => r.attendancePct !== null);
  const avgAttendance =
    withAttendance.length > 0
      ? withAttendance.reduce((sum, r) => sum + (r.attendancePct ?? 0), 0) / withAttendance.length
      : null;
  const priorityCount = bandCounts.PRIORITY + bandCounts.URGENT;
  const lowAttendanceCount = allRows.filter(
    (r) => r.attendancePct !== null && r.attendancePct < 80,
  ).length;

  const showBehaviourColumns = pageRows.some(
    (r) => r.band === "URGENT" || r.band === "PRIORITY",
  );

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

  // Same layout as the school-wide Student directory, so teachers and leaders learn one page.
  return (
    <div className={styles.page}>
      <PageHeader
        variant="ledger"
        className={styles.header}
        title="My students"
        subtitle="Pastoral risk and attendance for students in your classes."
      />

      <StudentsKpiStrip
        basePath={BASE_PATH}
        urlBase={urlBase}
        cohortCount={allRows.length}
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

      <section className={styles.directory} aria-label="Your students">
        <div className={styles.listHeading}>
          <div>
            <h2>{viewMode === "attention" ? "Students needing attention" : "Students in your classes"}</h2>
          </div>
          <span className={styles.resultCount}>{totalFiltered.toLocaleString("en-GB")} {totalFiltered === 1 ? "student" : "students"}</span>
        </div>

        <section className={styles.filters} aria-label="Find students">
          <StudentsBandChips
            basePath={BASE_PATH}
            urlBase={urlBase}
            bandCounts={bandCounts}
            activeBand={bandFilter}
            activeView={viewMode}
          />
          <StudentsToolbar
            basePath={BASE_PATH}
            yearGroups={yearGroups}
            urlBase={urlBase}
            activeChips={activeChips}
          />
        </section>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16">
            <p className="text-[0.875rem] font-semibold text-text">
              {allRows.length === 0 ? "No students linked to your classes yet" : "No matches"}
            </p>
            <p className="mt-1 text-[0.8125rem] text-muted">
              {allRows.length === 0
                ? "Students appear here once your classes are set up."
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
            pageRows={pageRows}
            windowDays={windowDays}
            listPath={listPath}
            showBehaviourColumns={showBehaviourColumns}
            pageStart={pageStart}
            pageEnd={pageEnd}
            totalFiltered={totalFiltered}
            pagination={pagination}
          />
        )}
      </section>
    </div>
  );
}
