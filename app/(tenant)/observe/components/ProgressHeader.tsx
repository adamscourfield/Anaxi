"use client";

export function ProgressHeader({
  current,
  total,
  signalTitle,
  onBack,
  onExit,
  canBack,
}: {
  current: number;
  total: number;
  signalTitle?: string;
  onBack: () => void;
  onExit: () => void;
  canBack: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          disabled={!canBack}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg calm-transition ${
            canBack
              ? "text-muted hover:bg-surface-container-high hover:text-text"
              : "cursor-not-allowed text-border"
          }`}
          aria-label="Previous signal"
        >
          <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
            <path d="M10 3.5 5.5 8l4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5">
          {signalTitle && (
            <span className="max-w-xs truncate text-[0.75rem] font-semibold text-muted">
              {signalTitle}
            </span>
          )}
          <span className="text-[0.6875rem] font-medium tabular-nums text-border">
            {current} / {total}
          </span>
        </div>

        <button
          type="button"
          onClick={onExit}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted calm-transition hover:bg-surface-container-high hover:text-text"
          aria-label="Exit observation"
        >
          <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Segmented progress bar */}
      <div className="flex items-center gap-[3px]">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-md calm-transition ${
              i < current ? "bg-accent" : "bg-border/50"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
