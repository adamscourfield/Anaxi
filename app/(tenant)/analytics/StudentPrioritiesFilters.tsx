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
  /** Preserve table sort when applying filters */
  tableSort?: { sort: string; dir: string };
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
  tableSort,
  defaults,
  hasFilters,
}: StudentPrioritiesFiltersProps) {
  const triggerWhite = "field-filter-trigger";

  return (
    <div className="anx-priorities-student-filters">
      <form
        method="get"
        action="/analytics"
        className="flex w-full flex-col gap-5 xl:flex-row xl:flex-wrap xl:items-end xl:justify-between"
      >
        <input type="hidden" name="tab" value="students" />
        <input type="hidden" name="window" value={String(windowDays)} />
        {tableSort?.sort ? <input type="hidden" name="sort" value={tableSort.sort} /> : null}
        {tableSort?.dir ? <input type="hidden" name="dir" value={tableSort.dir} /> : null}

        <div className="flex min-w-0 flex-1 flex-wrap gap-x-4 gap-y-4">
          <label className="flex min-w-[8.75rem] flex-1 flex-col gap-1.5 sm:min-w-[7.5rem]">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">
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

          <label className="flex min-w-[6.5rem] flex-1 flex-col gap-1.5 sm:min-w-[5.5rem]">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">SEND</span>
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

          <label className="flex min-w-[6.5rem] flex-1 flex-col gap-1.5 sm:min-w-[5.5rem]">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">PP</span>
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

          <label className="flex min-w-[8rem] flex-1 flex-col gap-1.5 sm:min-w-[7rem]">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">Band</span>
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

          <label className="flex min-w-[7.5rem] flex-1 flex-col gap-1.5 sm:min-w-[6.5rem]">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">
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

          <label className="flex min-w-[9rem] flex-1 flex-col gap-1.5 sm:min-w-[8rem]">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">
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
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 xl:justify-end">
          <button type="submit" className="btn-priorities-apply">
            Apply filters
          </button>
          {hasFilters && (
            <Link
              href={`/analytics?tab=students&window=${windowDays}`}
              className="inline-flex items-center justify-center rounded-lg border border-[#e5e7eb] bg-white px-4 py-2.5 text-sm font-semibold text-[#374151] shadow-sm calm-transition hover:bg-[#f9fafb]"
            >
              Clear
            </Link>
          )}
        </div>
      </form>
    </div>
  );
}
