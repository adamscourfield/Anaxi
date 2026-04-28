"use client";

import Link from "next/link";

type Props = {
  basePath: string;
  defaultSearch: string;
  defaultPp: string;
  defaultSend: string;
  hasFilters: boolean;
  totalShown: number;
  totalAll: number;
};

const triggerWhite = "field-filter-trigger";

export function SubjectStudentsFilterBar({
  basePath,
  defaultSearch,
  defaultPp,
  defaultSend,
  hasFilters,
  totalShown,
  totalAll,
}: Props) {
  return (
    <div className="filter-panel">
      <form
        method="get"
        action={basePath}
        className="flex w-full flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end lg:gap-x-4 lg:gap-y-4"
      >
        {/* Name search */}
        <label className="flex min-w-0 flex-1 flex-col gap-1.5 lg:min-w-[200px] lg:max-w-[360px]">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">Search</span>
          <div className="relative">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
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
              type="text"
              name="q"
              defaultValue={defaultSearch}
              placeholder="Search by name…"
              className={`field w-full py-2.5 pl-10 pr-4 ${triggerWhite}`}
            />
          </div>
        </label>

        {/* PP filter */}
        <label className="flex min-w-0 flex-1 flex-col gap-1.5 lg:min-w-[140px]">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">Pupil premium</span>
          <select name="pp" defaultValue={defaultPp} className={`field ${triggerWhite}`}>
            <option value="">All</option>
            <option value="true">PP</option>
            <option value="false">Non-PP</option>
          </select>
        </label>

        {/* SEND filter */}
        <label className="flex min-w-0 flex-1 flex-col gap-1.5 lg:min-w-[140px]">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">SEND</span>
          <select name="send" defaultValue={defaultSend} className={`field ${triggerWhite}`}>
            <option value="">All</option>
            <option value="true">SEND</option>
            <option value="false">Non-SEND</option>
          </select>
        </label>

        {/* Actions */}
        <div className="filter-actions">
          <button type="submit" className="btn-filter-primary">
            Apply Filters
          </button>
          {hasFilters && (
            <Link href={basePath} className="btn-filter-secondary">
              Clear
            </Link>
          )}
        </div>
      </form>

      <p className="mt-4 border-t border-border/20 pt-4 text-center text-[0.8125rem] text-muted sm:text-right">
        Showing <span className="font-semibold text-text">{totalShown}</span> of{" "}
        <span className="font-semibold text-text">{totalAll}</span> students
      </p>
    </div>
  );
}
