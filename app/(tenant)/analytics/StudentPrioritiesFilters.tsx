"use client";

import Link from "next/link";
import { FormSelect } from "@/components/ui/form-select";
import type { RiskBand } from "@/modules/analysis/studentRisk";

const BAND_OPTIONS: { value: RiskBand; label: string }[] = [
  { value: "URGENT", label: "Urgent" },
  { value: "PRIORITY", label: "Priority" },
  { value: "WATCH", label: "Watch" },
  { value: "STABLE", label: "Stable" },
];

interface StudentPrioritiesFiltersProps {
  yearGroups: string[];
  windowDays: number;
  defaults: {
    yearGroup: string;
    send: string;
    pp: string;
    band: string;
    confidence: string;
    watchlist: boolean;
  };
  hasFilters: boolean;
}

export function StudentPrioritiesFilters({
  yearGroups,
  windowDays,
  defaults,
  hasFilters,
}: StudentPrioritiesFiltersProps) {
  const triggerWhite = "!bg-surface-container-lowest rounded-[10px]";

  return (
    <div className="w-full rounded-2xl bg-surface-container-low p-5 shadow-ambient md:p-6">
      <form
        method="get"
        action="/analytics"
        className="flex w-full flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end lg:gap-x-4 lg:gap-y-4"
      >
        <input type="hidden" name="tab" value="students" />
        <input type="hidden" name="window" value={String(windowDays)} />

        <label className="flex min-w-0 flex-1 flex-col gap-1.5 lg:min-w-[140px]">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
            Year group
          </span>
          <FormSelect
            name="yearGroup"
            defaultValue={defaults.yearGroup}
            placeholder="All years"
            triggerClassName={triggerWhite}
            options={[
              { value: "", label: "All years" },
              ...yearGroups.map((y) => ({ value: y, label: y })),
            ]}
          />
        </label>

        <label className="flex min-w-0 flex-1 flex-col gap-1.5 lg:min-w-[120px]">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">SEND</span>
          <FormSelect
            name="send"
            defaultValue={defaults.send}
            placeholder="Any"
            triggerClassName={triggerWhite}
            options={[
              { value: "", label: "Any" },
              { value: "yes", label: "Yes" },
              { value: "no", label: "No" },
            ]}
          />
        </label>

        <label className="flex min-w-0 flex-1 flex-col gap-1.5 lg:min-w-[120px]">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">PP</span>
          <FormSelect
            name="pp"
            defaultValue={defaults.pp}
            placeholder="Any"
            triggerClassName={triggerWhite}
            options={[
              { value: "", label: "Any" },
              { value: "yes", label: "Yes" },
              { value: "no", label: "No" },
            ]}
          />
        </label>

        <label className="flex min-w-0 flex-1 flex-col gap-1.5 lg:min-w-[140px]">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">Band</span>
          <FormSelect
            name="band"
            defaultValue={defaults.band}
            placeholder="All bands"
            triggerClassName={triggerWhite}
            options={[
              { value: "", label: "All bands" },
              ...BAND_OPTIONS.map((b) => ({ value: b.value, label: b.label })),
            ]}
          />
        </label>

        <label className="flex min-w-0 flex-1 flex-col gap-1.5 lg:min-w-[130px]">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
            Confidence
          </span>
          <FormSelect
            name="confidence"
            defaultValue={defaults.confidence}
            placeholder="Any"
            triggerClassName={triggerWhite}
            options={[
              { value: "", label: "Any" },
              { value: "HIGH", label: "High" },
              { value: "LOW", label: "Low" },
            ]}
          />
        </label>

        <label className="flex min-w-0 flex-1 flex-col gap-1.5 lg:min-w-[160px]">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
            Watchlist
          </span>
          <FormSelect
            name="watchlist"
            defaultValue={defaults.watchlist ? "1" : ""}
            placeholder="All students"
            triggerClassName={triggerWhite}
            options={[
              { value: "", label: "All students" },
              { value: "1", label: "Watchlist only" },
            ]}
          />
        </label>

        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:ml-auto lg:w-auto lg:flex-none">
          <button
            type="submit"
            className="field flex w-full items-center justify-center border-0 bg-primary py-2.5 text-[0.8125rem] font-bold text-on-primary calm-transition hover:opacity-90 sm:min-w-[140px] lg:w-auto lg:min-w-[160px]"
          >
            Apply Filters
          </button>
          {hasFilters && (
            <Link
              href={`/analytics?tab=students&window=${windowDays}`}
              className="field flex w-full items-center justify-center border border-border/40 bg-surface-container-lowest py-2.5 text-center text-[0.8125rem] font-medium text-muted calm-transition hover:bg-surface-container-low hover:text-text sm:min-w-[100px] lg:w-auto"
            >
              Clear
            </Link>
          )}
        </div>
      </form>
    </div>
  );
}
