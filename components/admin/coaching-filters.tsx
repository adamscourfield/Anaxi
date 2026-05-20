"use client";

function FunnelIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

const CARD =
  "overflow-hidden rounded-sm border border-border bg-[var(--surface-container-lowest)] shadow-none";
const LABEL =
  "mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[var(--on-surface-variant)]";
const ICON_WELL =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#EEF2FF] text-[#4F46E5] [&_svg]:shrink-0";
const FIELD =
  "w-full min-h-[2.75rem] rounded-xl border border-[color-mix(in_srgb,var(--outline-variant)_55%,transparent)] bg-[var(--surface-container-lowest)] px-3.5 text-sm text-[var(--on-surface)] outline-none transition placeholder:text-[var(--on-surface-variant)] focus:border-[color-mix(in_srgb,var(--outline-variant)_50%,transparent)] focus:ring-2 focus:ring-[rgba(15,23,42,0.06)]";

/** Controlled filter bar for coaching assignments (client-only). */
export function CoachingFilters({
  coach,
  coachee,
  hasFilters,
  onCoachChange,
  onCoacheeChange,
  onClear,
}: {
  coach: string;
  coachee: string;
  hasFilters: boolean;
  onCoachChange: (value: string) => void;
  onCoacheeChange: (value: string) => void;
  onClear: () => void;
}) {
  return (
    <div className={CARD}>
      <div className="border-b border-[color-mix(in_srgb,var(--outline-variant)_55%,transparent)] px-6 py-6 sm:px-8 sm:py-7">
        <div className="flex gap-3 sm:gap-4">
          <span className={ICON_WELL} aria-hidden>
            <FunnelIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-bold tracking-tight text-[var(--on-surface)]">Filters</h2>
            <p className="mt-1 text-[0.8125rem] leading-relaxed text-[var(--on-surface-variant)]">
              Search assignments by coach or coachee.
            </p>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-4 px-6 py-7 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-4 sm:gap-y-4 sm:px-8 sm:pb-8">
        <label className="min-w-0 flex-1 sm:min-w-[200px]">
          <span className={LABEL}>Coach</span>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--on-surface-variant)]" />
            <input
              value={coach}
              onChange={(e) => onCoachChange(e.target.value)}
              placeholder="Filter by coach..."
              className={`${FIELD} pl-10`}
            />
          </div>
        </label>
        <label className="min-w-0 flex-1 sm:min-w-[200px]">
          <span className={LABEL}>Coachee</span>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--on-surface-variant)]" />
            <input
              value={coachee}
              onChange={(e) => onCoacheeChange(e.target.value)}
              placeholder="Filter by coachee..."
              className={`${FIELD} pl-10`}
            />
          </div>
        </label>
        {hasFilters ? (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex w-full items-center justify-center rounded-xl border border-transparent px-4 py-2.5 text-sm font-semibold text-[var(--on-surface-variant)] calm-transition hover:bg-[var(--surface-container-low)] hover:text-[var(--on-surface)] sm:w-auto"
          >
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}
