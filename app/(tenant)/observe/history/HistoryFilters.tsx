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
  /** Preserves chart preset across "Apply filters" (default 26w is omitted). */
  preservedAnalysisPreset?: string;
  preservedCoachingCoachId?: string;
  preservedCoachingCoacheeId?: string;
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
  preservedAnalysisPreset,
  preservedCoachingCoachId,
  preservedCoachingCoacheeId,
  showTeacherFilters,
  hasFilters,
}: HistoryFiltersProps) {
  const triggerWhite = "field-filter-trigger";

  return (
    <div className="filter-panel obs-history-filter-panel">
      <form
        method="get"
        action="/observe/history"
        className="flex w-full flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end lg:gap-x-4 lg:gap-y-4"
      >
        {preservedWindowDays != null && preservedWindowDays > 0 ? (
          <input type="hidden" name="window" value={String(preservedWindowDays)} />
        ) : null}
        {preservedAnalysisPreset && preservedAnalysisPreset !== "26w" ? (
          <input type="hidden" name="analysis" value={preservedAnalysisPreset} />
        ) : null}
        {preservedCoachingCoachId ? (
          <input type="hidden" name="coachingCoach" value={preservedCoachingCoachId} />
        ) : null}
        {preservedCoachingCoacheeId ? (
          <input type="hidden" name="coachingCoachee" value={preservedCoachingCoacheeId} />
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
        <div className="filter-actions">
          <button type="submit" className="btn-filter-primary">
            Apply Filters
          </button>
          {hasFilters && (
            <Link href="/observe/history" className="btn-filter-secondary">
              Clear
            </Link>
          )}
        </div>
      </form>
    </div>
  );
}
