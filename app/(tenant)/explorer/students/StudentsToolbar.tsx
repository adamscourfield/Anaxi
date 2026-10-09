"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormSelect } from "@/components/ui/form-select";
import {
  buildStudentsListUrl,
  DEFAULT_SORT_MODE,
  DEFAULT_STATUS_FILTER,
  DEFAULT_VIEW_MODE,
  type StudentsSortMode,
  type StudentsStatusFilter,
  type StudentsUrlParams,
  type StudentsViewMode,
} from "@/modules/students/explorerList";

const SORT_OPTIONS: { value: StudentsSortMode; label: string }[] = [
  { value: "risk", label: "Risk (default)" },
  { value: "attendance_asc", label: "Attendance: lowest first" },
  { value: "attendance_desc", label: "Attendance: highest first" },
  { value: "name", label: "Name (A–Z)" },
];

const STATUS_OPTIONS: { value: StudentsStatusFilter; label: string }[] = [
  { value: "active", label: "Active students" },
  { value: "archived", label: "Archived students" },
  { value: "all", label: "Active + archived" },
];

const WINDOWS = [
  { value: "7", label: "7 days" },
  { value: "21", label: "21 days" },
  { value: "28", label: "28 days" },
];

const SAVED_VIEWS_KEY = "anaxi-students-saved-views";

type SavedView = {
  id: string;
  name: string;
  params: Omit<StudentsUrlParams, "page">;
};

type Props = {
  basePath: string;
  yearGroups: string[];
  urlBase: StudentsUrlParams;
  activeChips: { key: string; label: string; removeHref: string }[];
  canManageStudents?: boolean;
};

export function StudentsToolbar({
  basePath,
  yearGroups,
  urlBase,
  activeChips,
  canManageStudents = false,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [search, setSearch] = useState(urlBase.studentSearch ?? "");
  const [yearGroup, setYearGroup] = useState(urlBase.yearGroup ?? "");
  const [band, setBand] = useState(urlBase.band ?? "");
  const [windowDays, setWindowDays] = useState(String(urlBase.windowDays));
  const [send, setSend] = useState(urlBase.send ?? "");
  const [pp, setPp] = useState(urlBase.pp ?? "");
  const [confidence, setConfidence] = useState(urlBase.confidence ?? "");
  const [watchlist, setWatchlist] = useState(urlBase.watchlist === "1");
  const [view, setView] = useState<StudentsViewMode>(
    urlBase.view ?? DEFAULT_VIEW_MODE,
  );
  const [status, setStatus] = useState<StudentsStatusFilter>(
    urlBase.status ?? DEFAULT_STATUS_FILTER,
  );
  const [sort, setSort] = useState<StudentsSortMode>(urlBase.sort ?? DEFAULT_SORT_MODE);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [saveName, setSaveName] = useState("");

  useEffect(() => {
    setSearch(urlBase.studentSearch ?? "");
    setYearGroup(urlBase.yearGroup ?? "");
    setBand(urlBase.band ?? "");
    setWindowDays(String(urlBase.windowDays));
    setSend(urlBase.send ?? "");
    setPp(urlBase.pp ?? "");
    setConfidence(urlBase.confidence ?? "");
    setWatchlist(urlBase.watchlist === "1");
    setView(urlBase.view ?? DEFAULT_VIEW_MODE);
    setStatus(urlBase.status ?? DEFAULT_STATUS_FILTER);
    setSort(urlBase.sort ?? DEFAULT_SORT_MODE);
  }, [urlBase]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVED_VIEWS_KEY);
      if (raw) setSavedViews(JSON.parse(raw) as SavedView[]);
    } catch {
      /* ignore */
    }
  }, []);

  const pushParams = useCallback(
    (overrides: Partial<StudentsUrlParams>) => {
      const href = buildStudentsListUrl(basePath, {
        windowDays: Number(windowDays) || 21,
        view,
        band: band || undefined,
        yearGroup: yearGroup || undefined,
        studentSearch: search || undefined,
        send: send || undefined,
        pp: pp || undefined,
        confidence: confidence || undefined,
        watchlist: watchlist ? "1" : undefined,
        attendanceBelow: urlBase.attendanceBelow,
        scope: urlBase.scope,
        status,
        sort,
        page: undefined,
        ...overrides,
      });
      startTransition(() => router.push(href));
    },
    [
      basePath,
      band,
      confidence,
      pp,
      router,
      search,
      send,
      sort,
      status,
      view,
      watchlist,
      windowDays,
      yearGroup,
      urlBase.attendanceBelow,
      urlBase.scope,
    ],
  );

  const schedulePush = useCallback(
    (overrides: Partial<StudentsUrlParams>, delay = 0) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => pushParams(overrides), delay);
    },
    [pushParams],
  );

  const clearHref = buildStudentsListUrl(basePath, {
    windowDays: urlBase.windowDays,
    scope: urlBase.scope,
  });

  const persistSavedViews = (next: SavedView[]) => {
    setSavedViews(next);
    localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(next));
  };

  const saveCurrentView = () => {
    const name = saveName.trim() || `View ${savedViews.length + 1}`;
    const entry: SavedView = {
      id: crypto.randomUUID(),
      name,
      params: {
        windowDays: Number(windowDays) || 21,
        view,
        band: band || undefined,
        yearGroup: yearGroup || undefined,
        studentSearch: search || undefined,
        send: send || undefined,
        pp: pp || undefined,
        confidence: confidence || undefined,
        watchlist: watchlist ? "1" : undefined,
        attendanceBelow: urlBase.attendanceBelow,
        scope: urlBase.scope,
        status,
        sort,
      },
    };
    persistSavedViews([...savedViews, entry]);
    setSaveName("");
  };

  const triggerWhite = "field-filter-trigger";

  return (
    <div className="space-y-4">
      <div className="filter-panel">
        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex min-w-0 flex-col gap-1.5 sm:col-span-2 lg:col-span-1">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
              Search
            </span>
            <div className="relative">
              <svg
                className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m17 17 4 4" strokeLinecap="round" />
              </svg>
              <input
                type="search"
                value={search}
                onChange={(e) => {
                  const v = e.target.value;
                  setSearch(v);
                  schedulePush({ studentSearch: v || undefined }, 350);
                }}
                placeholder="Search by name…"
                className={`field w-full !py-2.5 !pl-[2.875rem] pr-4 ${triggerWhite}`}
              />
            </div>
          </label>

          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
              Window
            </span>
            <FormSelect
              name="windowDays"
              defaultValue={windowDays}
              key={`window-${windowDays}`}
              placeholder="21 days"
              triggerClassName={triggerWhite}
              options={WINDOWS}
              onChange={(v) => {
                setWindowDays(v);
                pushParams({ windowDays: Number(v) });
              }}
            />
          </label>

          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
              Year group
            </span>
            <FormSelect
              name="yearGroup"
              defaultValue={yearGroup}
              key={`yg-${yearGroup}`}
              placeholder="All year groups"
              triggerClassName={triggerWhite}
              options={[
                { value: "", label: "All year groups" },
                ...yearGroups.map((yg) => ({ value: yg, label: yg })),
              ]}
              onChange={(v) => {
                setYearGroup(v);
                pushParams({ yearGroup: v || undefined });
              }}
            />
          </label>

          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
              SEN
            </span>
            <FormSelect
              name="send"
              defaultValue={send}
              key={`send-${send}`}
              placeholder="All"
              triggerClassName={triggerWhite}
              options={[
                { value: "", label: "All" },
                { value: "true", label: "SEN Yes" },
                { value: "false", label: "SEN No" },
              ]}
              onChange={(v) => {
                setSend(v);
                pushParams({ send: v || undefined });
              }}
            />
          </label>

          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
              Pupil premium
            </span>
            <FormSelect
              name="pp"
              defaultValue={pp}
              key={`pp-${pp}`}
              placeholder="All"
              triggerClassName={triggerWhite}
              options={[
                { value: "", label: "All" },
                { value: "true", label: "PP Yes" },
                { value: "false", label: "PP No" },
              ]}
              onChange={(v) => {
                setPp(v);
                pushParams({ pp: v || undefined });
              }}
            />
          </label>

          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
              Confidence
            </span>
            <FormSelect
              name="confidence"
              defaultValue={confidence}
              key={`confidence-${confidence}`}
              placeholder="All"
              triggerClassName={triggerWhite}
              options={[
                { value: "", label: "All" },
                { value: "HIGH", label: "High confidence" },
                { value: "LOW", label: "Low confidence" },
              ]}
              onChange={(v) => {
                setConfidence(v);
                pushParams({ confidence: v || undefined });
              }}
            />
          </label>

          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
              Sort by
            </span>
            <FormSelect
              name="sort"
              defaultValue={sort}
              key={`sort-${sort}`}
              placeholder="Risk (default)"
              triggerClassName={triggerWhite}
              options={SORT_OPTIONS}
              onChange={(v) => {
                const next = v as StudentsSortMode;
                setSort(next);
                pushParams({ sort: next });
              }}
            />
          </label>

          {canManageStudents && (
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
                Status
              </span>
              <FormSelect
                name="status"
                defaultValue={status}
                key={`status-${status}`}
                placeholder="Active students"
                triggerClassName={triggerWhite}
                options={STATUS_OPTIONS}
                onChange={(v) => {
                  const next = v as StudentsStatusFilter;
                  setStatus(next);
                  pushParams({ status: next });
                }}
              />
            </label>
          )}

          <label className="flex items-center gap-2 self-end pb-2.5">
            <input
              type="checkbox"
              checked={watchlist}
              onChange={(e) => {
                setWatchlist(e.target.checked);
                pushParams({ watchlist: e.target.checked ? "1" : undefined });
              }}
              className="h-4 w-4 rounded border-border"
            />
            <span className="text-[0.8125rem] font-medium text-text">Watchlist only</span>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/20 pt-4">
          {savedViews.length > 0 && (
            <FormSelect
              name="savedView"
              defaultValue=""
              key="saved-view-picker"
              placeholder="Saved views…"
              triggerClassName={`${triggerWhite} min-w-[140px]`}
              options={[
                { value: "", label: "Saved views…" },
                ...savedViews.map((sv) => ({ value: sv.id, label: sv.name })),
              ]}
              onChange={(id) => {
                const found = savedViews.find((s) => s.id === id);
                if (found) {
                  startTransition(() =>
                    router.push(buildStudentsListUrl(basePath, found.params)),
                  );
                }
              }}
            />
          )}
          <input
            type="text"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="Name this view…"
            className={`field max-w-[160px] !py-2 !text-[0.8125rem] ${triggerWhite}`}
          />
          <button
            type="button"
            onClick={saveCurrentView}
            className="btn-filter-secondary text-[0.8125rem]"
          >
            Save view
          </button>
          {activeChips.length > 0 && (
            <a href={clearHref} className="btn-filter-secondary text-[0.8125rem]">
              Clear all
            </a>
          )}
        </div>
      </div>

      {activeChips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {activeChips.map((chip) => (
            <a
              key={chip.key}
              href={chip.removeHref}
              className="inline-flex items-center gap-1.5 rounded-full bg-surface-container-low px-3 py-1 text-[0.75rem] font-medium text-text ring-1 ring-inset ring-[color-mix(in_srgb,var(--outline-variant)_35%,transparent)] hover:bg-surface-container-high"
            >
              {chip.label}
              <span className="text-muted" aria-hidden>
                ×
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
