"use client";

import Link from "next/link";

type Props = {
  basePath: string;
  defaultSearch: string;
  defaultMet: "" | "true" | "all";
  defaultPp: "" | "true" | "false";
  defaultSend: "" | "true" | "false";
  hasFilters: boolean;
};

const triggerWhite = "field-filter-trigger";

export function EMTargetGroupToolbar({
  basePath,
  defaultSearch,
  defaultMet,
  defaultPp,
  defaultSend,
  hasFilters,
}: Props) {
  return (
    <div className="filter-panel shadow-none">
      <form
        method="get"
        action={basePath}
        className="flex w-full flex-col gap-5 xl:flex-row xl:items-end xl:justify-between xl:gap-8"
      >
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-x-5 lg:gap-y-4">
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="filter-field-label">Search</span>
            <div className="relative">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m17 17 4 4" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                name="studentSearch"
                defaultValue={defaultSearch}
                placeholder="Search students..."
                className={`field w-full py-2.5 pl-10 pr-4 ${triggerWhite}`}
              />
            </div>
          </label>

          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="filter-field-label">Threshold</span>
            <select name="met" defaultValue={defaultMet} className={`field ${triggerWhite}`}>
              <option value="">Not met (both E&amp;M)</option>
              <option value="true">Met (both E&amp;M)</option>
              <option value="all">All students</option>
            </select>
          </label>

          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="filter-field-label">Pupil premium</span>
            <select name="pp" defaultValue={defaultPp} className={`field ${triggerWhite}`}>
              <option value="">All</option>
              <option value="true">PP</option>
              <option value="false">Non-PP</option>
            </select>
          </label>

          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="filter-field-label">SEND</span>
            <select name="send" defaultValue={defaultSend} className={`field ${triggerWhite}`}>
              <option value="">All</option>
              <option value="true">SEND</option>
              <option value="false">Non-SEND</option>
            </select>
          </label>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:justify-end xl:flex-col xl:self-end">
          <button type="submit" className="btn-filter-primary btn-filter-primary--pill justify-center">
            Apply Filters
          </button>
          {hasFilters ? (
            <Link href={basePath} className="btn-filter-secondary justify-center text-center no-underline">
              Clear
            </Link>
          ) : null}
        </div>
      </form>
    </div>
  );
}
