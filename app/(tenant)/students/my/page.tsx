import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { parseWindow } from "@/lib/explorerUtils";
import { computeStudentRiskIndex } from "@/modules/analysis/studentRisk";
import { getTeacherStudentIds } from "@/modules/students/teacherScope";
import {
  buildStudentsListUrl,
  countBands,
  DEFAULT_VIEW_MODE,
  filterStudentRows,
  getPageSize,
  parseViewMode,
  type StudentsListFilters,
  type StudentsUrlParams,
} from "@/modules/students/explorerList";
import { StudentsToolbar } from "@/app/(tenant)/explorer/students/StudentsToolbar";
import { StudentsKpiStrip } from "@/app/(tenant)/explorer/students/StudentsKpiStrip";
import { StudentsBandChips } from "@/app/(tenant)/explorer/students/StudentsBandChips";
import { StudentsCriticalBanner } from "@/app/(tenant)/explorer/students/StudentsCriticalBanner";
import { StudentsListSection } from "@/app/(tenant)/explorer/students/StudentsListSection";

const BASE_PATH = "/students/my";

function firstParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const v = params[key];
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

function buildActiveChips(
  basePath: string,
  urlBase: StudentsUrlParams,
  filters: StudentsListFilters,
): { key: string; label: string; removeHref: string }[] {
  const chips: { key: string; label: string; removeHref: string }[] = [];
  const omit = (overrides: Partial<StudentsUrlParams>) =>
    buildStudentsListUrl(basePath, { ...urlBase, ...overrides, page: undefined });

  if (filters.studentSearch) {
    chips.push({
      key: "search",
      label: `Search: ${filters.studentSearch}`,
      removeHref: omit({ studentSearch: undefined }),
    });
  }
  if (filters.yearGroup) {
    chips.push({
      key: "year",
      label: `Year: ${filters.yearGroup}`,
      removeHref: omit({ yearGroup: undefined }),
    });
  }
  if (filters.band) {
    chips.push({
      key: "band",
      label: `Band: ${filters.band}`,
      removeHref: omit({ band: undefined }),
    });
  } else if (filters.view === "attention") {
    chips.push({
      key: "view",
      label: "Needs attention",
      removeHref: omit({ view: "all" }),
    });
  }
  if (filters.watchlistOnly) {
    chips.push({
      key: "watchlist",
      label: "Watchlist only",
      removeHref: omit({ watchlist: undefined }),
    });
  }
  return chips;
}

export default async function MyStudentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "STUDENTS");

  if (user.role !== "TEACHER" && user.role !== "LEADER") {
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
            Open assessments
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
    watchlistOnly: watchlistFilter,
    attendanceBelow80: attendanceBelow,
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
  const pageRows = rows.slice(pageStart, pageEnd);

  const avgAttendance =
    allRows.length > 0
      ? allRows.reduce((sum, r) => sum + (r.attendancePct ?? 0), 0) / allRows.length
      : 0;
  const priorityCount = bandCounts.PRIORITY + bandCounts.URGENT;
  const lowAttendanceCount = allRows.filter(
    (r) => r.attendancePct !== null && r.attendancePct < 80,
  ).length;

  const showBehaviourColumns = pageRows.some(
    (r) => r.band === "URGENT" || r.band === "PRIORITY",
  );

  return (
    <div className="space-y-6">
      <nav className="text-[0.8125rem] text-muted" aria-label="Breadcrumb">
        <Link href="/home" className="hover:text-text">
          Home
        </Link>
        <span className="mx-2">/</span>
        <span className="text-text">My students</span>
      </nav>

      <PageHeader
        variant="ledger"
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

      <StudentsBandChips
        basePath={BASE_PATH}
        urlBase={urlBase}
        bandCounts={bandCounts}
        activeBand={bandFilter}
        activeView={viewMode}
      />

      <StudentsCriticalBanner
        basePath={BASE_PATH}
        urlBase={urlBase}
        priorityCount={priorityCount}
        windowDays={windowDays}
        computedAt={computedAt}
      />

      <StudentsToolbar
        basePath={BASE_PATH}
        yearGroups={yearGroups}
        urlBase={urlBase}
        activeChips={activeChips}
      />

      {rows.length === 0 ? (
        <p className="text-sm text-muted">No students match your filters.</p>
      ) : (
        <StudentsListSection
          pageRows={pageRows}
          windowDays={windowDays}
          listPath={listPath}
          showBehaviourColumns={showBehaviourColumns}
          pageStart={pageStart}
          pageEnd={pageEnd}
          totalFiltered={totalFiltered}
          pagination={null}
        />
      )}
    </div>
  );
}
