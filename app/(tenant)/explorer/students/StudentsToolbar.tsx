"use client";

import Link from "next/link";
import { FormSelect } from "@/components/ui/form-select";

type Props = {
  yearGroups: string[];
  defaultSearch: string;
  defaultYearGroup: string;
  defaultBand: string;
  defaultWindow: string;
  hasFilters: boolean;
};

const BANDS = [
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

export function StudentsToolbar({
  yearGroups,
  defaultSearch,
  defaultYearGroup,
  defaultBand,
  defaultWindow,
  hasFilters,
}: Props) {
  const triggerWhite = "!bg-surface-container-lowest rounded-[10px]";

  return (
    <div className="w-full rounded-2xl bg-surface-container-low p-5 shadow-ambient md:p-6">
      <form
        method="get"
        action="/explorer/students"
        className="flex w-full flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end lg:gap-x-4 lg:gap-y-4"
      >
        <label className="flex min-w-0 flex-1 flex-col gap-1.5 lg:min-w-[180px]">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
            Search
          </span>
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
              placeholder="Search students…"
              className={`field w-full py-2.5 pl-10 pr-4 ${triggerWhite}`}
            />
          </div>
        </label>

        <label className="flex min-w-0 flex-1 flex-col gap-1.5 lg:min-w-[140px]">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
            Analysis window
          </span>
          <select
            name="windowDays"
            defaultValue={defaultWindow}
            className={`field ${triggerWhite}`}
          >
            {WINDOWS.map((w) => (
              <option key={w.value} value={w.value}>
                {w.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-w-0 flex-1 flex-col gap-1.5 lg:min-w-[140px]">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
            Year group
          </span>
          <FormSelect
            name="yearGroup"
            defaultValue={defaultYearGroup}
            placeholder="All year groups"
            triggerClassName={triggerWhite}
            options={[
              { value: "", label: "All year groups" },
              ...yearGroups.map((yg) => ({ value: yg, label: yg })),
            ]}
          />
        </label>

        <label className="flex min-w-0 flex-1 flex-col gap-1.5 lg:min-w-[140px]">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
            Risk band
          </span>
          <FormSelect
            name="band"
            defaultValue={defaultBand}
            placeholder="All risk bands"
            triggerClassName={triggerWhite}
            options={[
              { value: "", label: "All risk bands" },
              ...BANDS.map((b) => ({ value: b.value, label: b.label })),
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
              href="/explorer/students"
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
