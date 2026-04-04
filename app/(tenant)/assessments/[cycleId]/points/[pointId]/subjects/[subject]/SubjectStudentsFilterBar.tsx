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

const triggerWhite = "!bg-surface-container-lowest rounded-[10px]";

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
    <div className="w-full rounded-2xl bg-surface-container-low p-5 shadow-sm md:p-6">
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
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:ml-auto lg:w-auto lg:flex-none">
          <button
            type="submit"
            className="field flex w-full items-center justify-center border-0 bg-primary py-2.5 text-[0.8125rem] font-bold text-on-primary calm-transition hover:opacity-90 sm:min-w-[140px] lg:w-auto lg:min-w-[160px]"
          >
            Apply Filters
          </button>
          {hasFilters && (
            <Link
              href={basePath}
              className="field flex w-full items-center justify-center border border-border/40 bg-surface-container-lowest py-2.5 text-center text-[0.8125rem] font-medium text-muted calm-transition hover:bg-surface-container-low hover:text-text sm:min-w-[100px] lg:w-auto"
            >
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
