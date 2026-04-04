"use client";

import Link from "next/link";
import { FormSelect } from "@/components/ui/form-select";

interface HistoryFiltersProps {
  teachers: { id: string; fullName: string }[];
  observers: { id: string; fullName: string }[];
  subjects: string[];
  signalOptions: { key: string; label: string }[];
  defaults: {
    teacherId: string;
    observerId: string;
    subject: string;
    from: string;
    to: string;
    signalKey: string;
  };
  /** When set, a hidden `window` field is submitted so date-window deep links stay applied. */
  preservedWindowDays: number | null;
  showTeacherFilters: boolean;
  hasFilters: boolean;
}

export function HistoryFilters({
  teachers,
  observers,
  subjects,
  signalOptions,
  defaults,
  preservedWindowDays,
  showTeacherFilters,
  hasFilters,
}: HistoryFiltersProps) {
  const triggerWhite = "!bg-surface-container-lowest rounded-[10px]";

  return (
    <div className="w-full rounded-2xl bg-surface-container-low p-5 shadow-ambient md:p-6">
      <form
        method="get"
        action="/observe/history"
        className="flex w-full flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end lg:gap-x-4 lg:gap-y-4"
      >
        {preservedWindowDays != null && preservedWindowDays > 0 ? (
          <input type="hidden" name="window" value={String(preservedWindowDays)} />
        ) : null}
        {showTeacherFilters && (
          <>
            <label className="flex min-w-0 flex-1 flex-col gap-1.5 lg:min-w-[140px]">
              <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">Teacher</span>
              <FormSelect
                name="teacherId"
                defaultValue={defaults.teacherId}
                placeholder="All Teachers"
                searchable
                triggerClassName={triggerWhite}
                options={[
                  { value: "", label: "All Teachers" },
                  ...teachers.map((t) => ({ value: t.id, label: t.fullName })),
                ]}
              />
            </label>
            <label className="flex min-w-0 flex-1 flex-col gap-1.5 lg:min-w-[140px]">
              <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">Observer</span>
              <FormSelect
                name="observerId"
                defaultValue={defaults.observerId}
                placeholder="All Observers"
                searchable
                triggerClassName={triggerWhite}
                options={[
                  { value: "", label: "All Observers" },
                  ...observers.map((o) => ({ value: o.id, label: o.fullName })),
                ]}
              />
            </label>
          </>
        )}
        <label className="flex min-w-0 flex-1 flex-col gap-1.5 lg:min-w-[140px]">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">Subject / Year</span>
          <FormSelect
            name="subject"
            defaultValue={defaults.subject}
            placeholder="All Curricula"
            triggerClassName={triggerWhite}
            options={[
              { value: "", label: "All Curricula" },
              ...subjects.map((s) => ({ value: s, label: s })),
            ]}
          />
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-1.5 lg:min-w-[200px]">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">Pedagogical signal</span>
          <FormSelect
            name="signalKey"
            defaultValue={defaults.signalKey}
            placeholder="Any signal"
            searchable
            triggerClassName={triggerWhite}
            options={[
              { value: "", label: "Any signal" },
              ...signalOptions.map((s) => ({ value: s.key, label: s.label })),
            ]}
          />
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-1.5 lg:min-w-[140px]">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">From Date</span>
          <input
            name="from"
            type="date"
            defaultValue={defaults.from}
            className={`field ${triggerWhite}`}
          />
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-1.5 lg:min-w-[140px]">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">To Date</span>
          <input name="to" type="date" defaultValue={defaults.to} className={`field ${triggerWhite}`} />
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
              href="/observe/history"
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
