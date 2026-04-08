"use client";

import Link from "next/link";
import { FormSelect } from "@/components/ui/form-select";

const VALID_WINDOWS = [7, 21, 28] as const;

type Props = {
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
  yearGroups,
  defaults,
  hasActiveFilters,
  buildClearHref,
}: Props) {
  const triggerField = "!rounded-xl !border !border-border/35 !bg-[var(--surface-container-lowest)] !shadow-none";

  return (
    <div className="relative z-30 rounded-2xl glass-card p-5 md:p-6">
      <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--on-surface-variant)]">
        Filters
      </p>
      <form
        method="get"
        action="/explorer/analysis"
        className="flex w-full flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end lg:gap-x-4 lg:gap-y-4"
      >
        <label className="flex min-w-0 flex-1 flex-col gap-1.5 lg:min-w-[120px]">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">Window</span>
          <FormSelect
            name="windowDays"
            defaultValue={String(defaults.windowDays)}
            placeholder="Window"
            triggerClassName={triggerField}
            options={VALID_WINDOWS.map((w) => ({ value: String(w), label: `${w} days` }))}
          />
        </label>

        <label className="flex min-w-0 flex-1 flex-col gap-1.5 lg:min-w-[140px]">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">Year group</span>
          <FormSelect
            name="yearGroup"
            defaultValue={defaults.yearGroup}
            placeholder="All years"
            triggerClassName={triggerField}
            options={[{ value: "", label: "All years" }, ...yearGroups.map((yg) => ({ value: yg, label: yg }))]}
          />
        </label>

        <label className="flex min-w-0 items-center gap-2.5 rounded-xl border border-border/35 bg-[var(--surface-container-lowest)] px-3.5 py-2.5 lg:flex-none">
          <input
            type="checkbox"
            name="pp"
            value="1"
            defaultChecked={defaults.pp}
            className="h-4 w-4 rounded border-border/50 accent-[var(--primary)]"
          />
          <span className="text-[0.8125rem] font-medium text-[var(--on-surface)]">PP</span>
        </label>

        <label className="flex min-w-0 items-center gap-2.5 rounded-xl border border-border/35 bg-[var(--surface-container-lowest)] px-3.5 py-2.5 lg:flex-none">
          <input
            type="checkbox"
            name="send"
            value="1"
            defaultChecked={defaults.send}
            className="h-4 w-4 rounded border-border/50 accent-[var(--primary)]"
          />
          <span className="text-[0.8125rem] font-medium text-[var(--on-surface)]">SEND</span>
        </label>

        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:ml-auto lg:w-auto lg:flex-none">
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center rounded-xl bg-[var(--primary)] px-5 py-2.5 text-[0.8125rem] font-semibold text-on-primary shadow-ambient calm-transition hover:opacity-90 sm:min-w-[140px] lg:w-auto lg:min-w-[160px]"
          >
            Apply filters
          </button>
          {hasActiveFilters && (
            <Link
              href={buildClearHref}
              className="inline-flex w-full items-center justify-center rounded-xl border border-border/40 bg-[var(--surface-container-lowest)] px-4 py-2.5 text-center text-[0.8125rem] font-medium text-muted calm-transition hover:bg-[var(--surface-container-low)] hover:text-text sm:min-w-[100px] lg:w-auto"
            >
              Clear
            </Link>
          )}
        </div>
      </form>
    </div>
  );
}
