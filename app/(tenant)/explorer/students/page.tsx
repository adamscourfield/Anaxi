import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { ExplorerBackLink } from "@/components/explorer/explorer-chrome";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
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
  buildStudentsListUrl,
  countBands,
  DEFAULT_VIEW_MODE,
  filterStudentRows,
  getPageSize,
  parseViewMode,
  type StudentsListFilters,
  type StudentsUrlParams,
} from "@/modules/students/explorerList";
import { StudentsToolbar } from "./StudentsToolbar";
import { StudentsKpiStrip } from "./StudentsKpiStrip";
import { StudentsBandChips } from "./StudentsBandChips";
import { StudentsCriticalBanner } from "./StudentsCriticalBanner";
import { StudentsListSection } from "./StudentsListSection";

const BASE_PATH = "/explorer/students";

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
  } else if (filters.view !== "all") {
    chips.push({
      key: "view",
      label: `View: ${filters.view}`,
      removeHref: omit({ view: DEFAULT_VIEW_MODE }),
    });
  }
  if (filters.send === "true") {
    chips.push({ key: "send", label: "SEN: Yes", removeHref: omit({ send: undefined }) });
  }
  if (filters.send === "false") {
    chips.push({ key: "send", label: "SEN: No", removeHref: omit({ send: undefined }) });
  }
  if (filters.pp === "true") {
    chips.push({ key: "pp", label: "PP: Yes", removeHref: omit({ pp: undefined }) });
  }
  if (filters.pp === "false") {
    chips.push({ key: "pp", label: "PP: No", removeHref: omit({ pp: undefined }) });
  }
  if (filters.watchlistOnly) {
    chips.push({
      key: "watchlist",
      label: "Watchlist only",
      removeHref: omit({ watchlist: undefined }),
    });
  }
  if (filters.attendanceBelow80) {
    chips.push({
      key: "att",
      label: "Below 80% attendance",
      removeHref: omit({ attendanceBelow: undefined }),
    });
  }
  if (urlBase.windowDays !== 21) {
    chips.push({
      key: "window",
      label: `${urlBase.windowDays}-day window`,
      removeHref: omit({ windowDays: 21 }),
    });
  }

  return chips;
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
  const watchlistFilter = firstParam(params, "watchlist") === "1";
  const attendanceBelow = firstParam(params, "attendanceBelow") === "1";
  const viewMode = parseViewMode(firstParam(params, "view"), bandFilter);
  const hasExplicitParams =
    firstParam(params, "view") ||
    bandFilter ||
    yearGroupFilter ||
    studentSearch ||
    sendFilter ||
    ppFilter ||
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
  );

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
    watchlistOnly: watchlistFilter,
    attendanceBelow80: attendanceBelow,
  };

  const rows = filterStudentRows(allRows, filters);
  const bandCounts = countBands(allRows);

  const urlBase: StudentsUrlParams = {
    windowDays,
    view: effectiveView !== DEFAULT_VIEW_MODE ? effectiveView : undefined,
    band: bandFilter || undefined,
    yearGroup: yearGroupFilter || undefined,
    studentSearch: studentSearch || undefined,
    send: sendFilter || undefined,
    pp: ppFilter || undefined,
    watchlist: watchlistFilter ? "1" : undefined,
    attendanceBelow: attendanceBelow ? "1" : undefined,
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

  const avgAttendance =
    allRows.length > 0
      ? allRows.reduce((sum, r) => sum + (r.attendancePct ?? 0), 0) / allRows.length
      : 0;
  const priorityCount = bandCounts.PRIORITY + bandCounts.URGENT;
  const lowAttendanceCount = allRows.filter(
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

  function paginationRange(): (number | "ellipsis")[] {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | "ellipsis")[] = [1];
    if (safePage > 3) pages.push("ellipsis");
    const start = Math.max(2, safePage - 1);
    const end = Math.min(totalPages - 1, safePage + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (safePage < totalPages - 2) pages.push("ellipsis");
    pages.push(totalPages);
    return pages;
  }

  const pagination =
    totalPages > 1 ? (
      <div className="flex items-center gap-1">
        {safePage > 1 ? (
          <Link
            href={pageUrl(safePage - 1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted calm-transition hover:bg-surface-container-low hover:text-text"
            aria-label="Previous page"
          >
            ‹
          </Link>
        ) : (
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-border">‹</span>
        )}
        {paginationRange().map((item, idx) =>
          item === "ellipsis" ? (
            <span key={`e-${idx}`} className="inline-flex h-8 w-8 items-center justify-center text-muted">
              …
            </span>
          ) : item === safePage ? (
            <span
              key={item}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-[0.8125rem] font-semibold text-on-primary"
            >
              {item}
            </span>
          ) : (
            <Link
              key={item}
              href={pageUrl(item)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[0.8125rem] text-muted calm-transition hover:bg-surface-container-low hover:text-text"
            >
              {item}
            </Link>
          ),
        )}
        {safePage < totalPages ? (
          <Link
            href={pageUrl(safePage + 1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted calm-transition hover:bg-surface-container-low hover:text-text"
            aria-label="Next page"
          >
            ›
          </Link>
        ) : (
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-border">›</span>
        )}
      </div>
    ) : null;

  return (
    <div className="space-y-6">
      <ExplorerBackLink />

      <PageHeader
        variant="ledger"
        eyebrow="Pastoral intelligence"
        title="Students"
        subtitle="Prioritised pastoral risk queue — who needs attention and why."
        actions={
          showExport ? (
            <form action="/api/explorer/export" method="POST" className="inline">
              <input type="hidden" name="view" value="STUDENT_RISK" />
              <input type="hidden" name="windowDays" value={String(windowDays)} />
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
        activeView={effectiveView}
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
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16">
          <p className="text-[0.875rem] font-semibold text-text">
            {allRows.length === 0 ? "No student data" : "No matches"}
          </p>
          <p className="mt-1 text-[0.8125rem] text-muted">
            {allRows.length === 0
              ? "Try widening the window period or import a behaviour snapshot."
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

      <p className="text-[0.75rem] text-muted">
        {windowDays}-day window · Updated {computedAt.toLocaleDateString("en-GB")}
        {" · "}
        <Link href="/students/import" className="text-muted underline hover:text-text">
          Import data
        </Link>
      </p>
    </div>
  );
}
