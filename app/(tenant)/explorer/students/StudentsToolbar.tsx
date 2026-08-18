"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormSelect } from "@/components/ui/form-select";
import {
  buildStudentsListUrl,
  DEFAULT_VIEW_MODE,
  type StudentsUrlParams,
  type StudentsViewMode,
} from "@/modules/students/explorerList";

const BANDS = [
  { value: "", label: "All risk bands" },
  { value: "URGENT", label: "Urgent" },
  { value: "PRIORITY", label: "Priority" },
  { value: "WATCH", label: "Watch" },
  { value: "STABLE", label: "Stable" },
];

const WINDOWS = [
  { value: "7", label: "7 days" },
  { value: "21", label: "21 days" },
  { value: "28", label: "28 days" },
];

const VIEW_SEGMENTS: { value: StudentsViewMode; label: string }[] = [
  { value: "attention", label: "Needs attention" },
  { value: "all", label: "All" },
  { value: "watch", label: "Watch" },
  { value: "stable", label: "Stable" },
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
};

export function StudentsToolbar({
  basePath,
  yearGroups,
  urlBase,
  activeChips,
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
      },
    };
    persistSavedViews([...savedViews, entry]);
    setSaveName("");
  };

  const triggerWhite = "field-filter-trigger";

  const segmentHref = (v: StudentsViewMode) =>
    buildStudentsListUrl(basePath, {
      ...urlBase,
      view: v,
      band: undefined,
      page: undefined,
    });

  return (
    <div className="space-y-4">
      <div className="segmented-toggle w-full max-w-2xl" role="tablist" aria-label="Student list view">
        {VIEW_SEGMENTS.map((seg) => (
          <a
            key={seg.value}
            href={segmentHref(seg.value)}
            role="tab"
            aria-selected={view === seg.value && !band}
            className={`segmented-toggle-btn flex-1 text-center ${view === seg.value && !band ? "segmented-toggle-btn-active" : ""}`}
            onClick={(e) => {
              e.preventDefault();
              setView(seg.value);
              setBand("");
              pushParams({ view: seg.value, band: undefined });
            }}
          >
            {seg.label}
          </a>
        ))}
      </div>

      <div className="filter-panel">
        <div className="flex w-full flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end lg:gap-x-4 lg:gap-y-4">
          <label className="flex min-w-0 flex-1 flex-col gap-1.5 lg:min-w-[180px]">
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

          <label className="flex min-w-0 flex-1 flex-col gap-1.5 lg:min-w-[120px]">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
              Window
            </span>
            <select
              value={windowDays}
              onChange={(e) => {
                const v = e.target.value;
                setWindowDays(v);
                pushParams({ windowDays: Number(v) });
              }}
              className={`field ${triggerWhite}`}
            >
              {WINDOWS.map((w) => (
                <option key={w.value} value={w.value}>
                  {w.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex min-w-0 flex-1 flex-col gap-1.5 lg:min-w-[120px]">
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

          <label className="flex min-w-0 flex-1 flex-col gap-1.5 lg:min-w-[120px]">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
              Risk band
            </span>
            <FormSelect
              name="band"
              defaultValue={band}
              key={`band-${band}`}
              placeholder="All risk bands"
              triggerClassName={triggerWhite}
              options={BANDS}
              onChange={(v) => {
                setBand(v);
                pushParams({ band: v || undefined, view: v ? "all" : view });
              }}
            />
          </label>

          <label className="flex min-w-0 flex-1 flex-col gap-1.5 lg:min-w-[100px]">
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

          <label className="flex min-w-0 flex-1 flex-col gap-1.5 lg:min-w-[100px]">
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

          <label className="flex min-w-0 flex-1 flex-col gap-1.5 lg:min-w-[130px]">
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

          <label className="flex items-end gap-2 pb-2.5 lg:pb-0">
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
