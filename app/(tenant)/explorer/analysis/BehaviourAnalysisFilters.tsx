"use client";

import Link from "next/link";
import { FormSelect } from "@/components/ui/form-select";
import { BehaviourFilterPresets } from "@/components/explorer/behaviour-filter-presets";

const VALID_WINDOWS = [7, 21, 28] as const;

type Props = {
  id?: string;
  yearGroups: string[];
  defaults: {
    windowDays: number;
    yearGroup: string;
    pp: boolean;
    send: boolean;
  };
  hasActiveFilters: boolean;
  buildClearHref: string;
};

export function BehaviourAnalysisFilters({
  id,
  yearGroups,
  defaults,
  hasActiveFilters,
  buildClearHref,
}: Props) {
  const triggerField =
    "!rounded-xl !border !border-outline-variant !bg-surface-container-lowest !shadow-none !min-h-[2.75rem]";

  return (
    <div
      id={id}
      className="anx-elevated-card relative z-30 scroll-mt-24 p-5 md:p-6"
    >
      <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.1em] text-muted">Filters</p>
      <form
        method="get"
        action="/explorer/analysis"
        className="flex w-full flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end lg:gap-x-4 lg:gap-y-4"
      >
        <label className="flex min-w-0 flex-1 flex-col gap-1.5 lg:min-w-[140px]">
          <span className="flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
            <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
            </svg>
            Window
          </span>
          <FormSelect
            name="windowDays"
            defaultValue={String(defaults.windowDays)}
            placeholder="Window"
            triggerClassName={triggerField}
            options={VALID_WINDOWS.map((w) => ({ value: String(w), label: `${w} days` }))}
          />
        </label>

        <label className="flex min-w-0 flex-1 flex-col gap-1.5 lg:min-w-[160px]">
          <span className="flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
            <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeLinecap="round" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" />
            </svg>
            Year group
          </span>
          <FormSelect
            name="yearGroup"
            defaultValue={defaults.yearGroup}
            placeholder="All years"
            triggerClassName={triggerField}
            options={[{ value: "", label: "All years" }, ...yearGroups.map((yg) => ({ value: yg, label: yg }))]}
          />
        </label>

        <label className="flex min-w-0 items-center gap-2.5 rounded-xl border border-outline-variant bg-surface-container-lowest px-3.5 py-2.5 lg:flex-none">
          <input
            type="checkbox"
            name="pp"
            value="1"
            defaultChecked={defaults.pp}
            className="h-4 w-4 rounded border-outline-variant accent-[#7C5CFF]"
          />
          <span className="text-[0.8125rem] font-medium text-text">PP</span>
        </label>

        <label className="flex min-w-0 items-center gap-2.5 rounded-xl border border-outline-variant bg-surface-container-lowest px-3.5 py-2.5 lg:flex-none">
          <input
            type="checkbox"
            name="send"
            value="1"
            defaultChecked={defaults.send}
            className="h-4 w-4 rounded border-outline-variant accent-[#7C5CFF]"
          />
          <span className="text-[0.8125rem] font-medium text-text">SEND</span>
        </label>

        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:ml-auto lg:w-auto lg:flex-none">
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-text px-5 py-2.5 text-sm font-semibold text-[var(--surface-container-lowest)] shadow-sm calm-transition hover:opacity-85 active:scale-[0.98] sm:min-w-[140px] lg:w-auto lg:min-w-[168px]"
          >
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M4 21v-7M4 10v-3M4 3v3M10 21v-9M10 8V3M16 21v-5M16 12V3M22 21v-9M22 10V3" strokeLinecap="round" />
            </svg>
            Apply filters
          </button>
          {hasActiveFilters && (
            <Link
              href={buildClearHref}
              className="inline-flex w-full items-center justify-center rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-center text-[0.8125rem] font-medium text-muted calm-transition hover:bg-surface-container-low hover:text-text sm:min-w-[100px] lg:w-auto"
            >
              Clear
            </Link>
          )}
        </div>
      </form>
      <BehaviourFilterPresets
        current={{
          windowDays: defaults.windowDays,
          yearGroup: defaults.yearGroup,
          pp: defaults.pp,
          send: defaults.send,
        }}
      />
    </div>
  );
}
