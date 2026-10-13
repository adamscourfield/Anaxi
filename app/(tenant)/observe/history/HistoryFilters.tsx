"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";


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
  const detailsRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const sync = () => { if (detailsRef.current) detailsRef.current.open = media.matches; };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  const activeCount = Object.values(defaults).filter(Boolean).length;
  const clearParams = new URLSearchParams();
  if (preservedAnalysisPreset && preservedAnalysisPreset !== "26w") clearParams.set("analysis", preservedAnalysisPreset);
  if (preservedCoachingCoachId) clearParams.set("coachingCoach", preservedCoachingCoachId);
  if (preservedCoachingCoacheeId) clearParams.set("coachingCoachee", preservedCoachingCoacheeId);
  const clearHref = `/observe/history${clearParams.size ? `?${clearParams}` : ""}`;

  return (
    <details ref={detailsRef} open className="obs-history-filters">
      <summary className="obs-history-filter-summary">Filters {activeCount > 0 && <span>{activeCount} applied</span>}<span aria-hidden="true">⌄</span></summary>
      <form
        key={JSON.stringify(defaults)}
        method="get"
        action="/observe/history"
        className="obs-history-filter-form" aria-label="Filter observations"
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
            <label className="obs-history-filter-field">
              <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">Teacher</span>
              <select aria-label="Teacher" name="teacherId" defaultValue={defaults.teacherId} className="obs-history-select"><option value="">All teachers</option>{teachers.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}</select>
            </label>
            <label className="obs-history-filter-field">
              <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">Observer</span>
              <select aria-label="Observer" name="observerId" defaultValue={defaults.observerId} className="obs-history-select"><option value="">All observers</option>{observers.map((o) => <option key={o.id} value={o.id}>{o.fullName}</option>)}</select>
            </label>
          </>
        )}
        <label className="obs-history-filter-field">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">Subject</span>
          <select aria-label="Subject" name="subject" defaultValue={defaults.subject} className="obs-history-select"><option value="">All subjects</option>{subjects.map((s) => <option key={s} value={s}>{s}</option>)}</select>
        </label>
        <label className="obs-history-filter-field">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">Signal</span>
          <select aria-label="Signal" name="signalKey" defaultValue={defaults.signalKey} className="obs-history-select"><option value="">Any signal</option>{signalOptions.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
        </label>
        <label className="obs-history-filter-field">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">From</span>
          <input
            aria-label="From"
            name="from"
            type="date"
            defaultValue={defaults.from}
            className="obs-history-date"
          />
        </label>
        <label className="obs-history-filter-field">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">To</span>
          <input aria-label="To" name="to" type="date" defaultValue={defaults.to} className="obs-history-date" />
        </label>
        <div className="obs-history-filter-actions">
          <button type="submit" className="btn-filter-primary">
            Apply filters
          </button>
          {hasFilters && (
            <Link href={clearHref} className="btn-filter-secondary">
              Clear filters
            </Link>
          )}
        </div>
      </form>
    </details>
  );
}
