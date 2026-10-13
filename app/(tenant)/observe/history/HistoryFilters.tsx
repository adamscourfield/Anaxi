"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";


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
  /** Preserves chart preset while observation filters change (default academic year is omitted). */
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
  const router = useRouter();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const keepPositionAfterNavigationRef = useRef(false);
  const [isPending, startTransition] = useTransition();
  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const sync = () => { if (detailsRef.current) detailsRef.current.open = media.matches; };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    if (!keepPositionAfterNavigationRef.current) return;
    keepPositionAfterNavigationRef.current = false;
    requestAnimationFrame(() => keepRecordsInView());
  }, [defaults]);
  const activeCount = Object.values(defaults).filter(Boolean).length;
  const clearParams = new URLSearchParams();
  if (preservedAnalysisPreset && preservedAnalysisPreset !== "academic_year") clearParams.set("analysis", preservedAnalysisPreset);
  if (preservedCoachingCoachId) clearParams.set("coachingCoach", preservedCoachingCoachId);
  if (preservedCoachingCoacheeId) clearParams.set("coachingCoachee", preservedCoachingCoacheeId);
  const clearHref = `/observe/history${clearParams.size ? `?${clearParams}` : ""}`;

  function keepRecordsInView() {
    document.getElementById("observation-records")?.scrollIntoView({ block: "start" });
  }

  function navigateToFilters(href: string) {
    keepPositionAfterNavigationRef.current = true;
    keepRecordsInView();
    startTransition(() => {
      router.replace(`${href}#observation-records`, { scroll: false });
    });
  }

  function updateFilters(form: HTMLFormElement) {
    const formData = new FormData(form);
    const params = new URLSearchParams();
    for (const [key, value] of formData.entries()) {
      const text = String(value).trim();
      if (text) params.set(key, text);
    }
    navigateToFilters(`/observe/history${params.size ? `?${params}` : ""}`);
  }

  return (
    <details ref={detailsRef} open className="obs-history-filters">
      <summary className="obs-history-filter-summary">Filters {activeCount > 0 && <span>{activeCount} applied</span>}<span aria-hidden="true">⌄</span></summary>
      <form
        key={JSON.stringify(defaults)}
        method="get"
        action="/observe/history"
        onSubmit={(event) => {
          event.preventDefault();
          updateFilters(event.currentTarget);
        }}
        aria-busy={isPending}
        className="obs-history-filter-form" aria-label="Filter observations"
      >
        {preservedWindowDays != null && preservedWindowDays > 0 ? (
          <input type="hidden" name="window" value={String(preservedWindowDays)} />
        ) : null}
        {preservedAnalysisPreset && preservedAnalysisPreset !== "academic_year" ? (
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
              <select aria-label="Teacher" name="teacherId" defaultValue={defaults.teacherId} onChange={(event) => updateFilters(event.currentTarget.form!)} className="obs-history-select"><option value="">All teachers</option>{teachers.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}</select>
            </label>
            <label className="obs-history-filter-field">
              <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">Observer</span>
              <select aria-label="Observer" name="observerId" defaultValue={defaults.observerId} onChange={(event) => updateFilters(event.currentTarget.form!)} className="obs-history-select"><option value="">All observers</option>{observers.map((o) => <option key={o.id} value={o.id}>{o.fullName}</option>)}</select>
            </label>
          </>
        )}
        <label className="obs-history-filter-field">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">Subject</span>
          <select aria-label="Subject" name="subject" defaultValue={defaults.subject} onChange={(event) => updateFilters(event.currentTarget.form!)} className="obs-history-select"><option value="">All subjects</option>{subjects.map((s) => <option key={s} value={s}>{s}</option>)}</select>
        </label>
        <label className="obs-history-filter-field">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">Signal</span>
          <select aria-label="Signal" name="signalKey" defaultValue={defaults.signalKey} onChange={(event) => updateFilters(event.currentTarget.form!)} className="obs-history-select"><option value="">Any signal</option>{signalOptions.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
        </label>
        <label className="obs-history-filter-field">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">From</span>
          <input
            aria-label="From"
            name="from"
            type="date"
            defaultValue={defaults.from}
            onChange={(event) => updateFilters(event.currentTarget.form!)}
            className="obs-history-date"
          />
        </label>
        <label className="obs-history-filter-field">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">To</span>
          <input aria-label="To" name="to" type="date" defaultValue={defaults.to} onChange={(event) => updateFilters(event.currentTarget.form!)} className="obs-history-date" />
        </label>
        <div className="obs-history-filter-actions">
          {hasFilters && (
            <button type="button" className="btn-filter-secondary" disabled={isPending} onClick={() => navigateToFilters(clearHref)}>
              Clear filters
            </button>
          )}
          <span className="obs-history-filter-status" role="status" aria-live="polite">
            {isPending ? "Updating results…" : ""}
          </span>
        </div>
      </form>
    </details>
  );
}
