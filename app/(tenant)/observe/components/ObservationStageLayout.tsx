"use client";

const STEPS = [
  { number: 1, label: "Session Details" },
  { number: 2, label: "Criteria & Metrics" },
  { number: 3, label: "Review & Submit" },
];

export function ObservationStageLayout({
  currentStep,
  children,
  /** Applied from `md` breakpoint so small screens use full main width */
  maxWidthClassName = "md:max-w-4xl",
}: {
  currentStep: 1 | 2 | 3;
  children: React.ReactNode;
  /** Wider layout for review step two-column content */
  maxWidthClassName?: string;
}) {
  return (
    <div className={`w-full min-w-0 max-w-full pb-12 md:mx-auto ${maxWidthClassName}`}>
      {/* Breadcrumb */}
      <div className="mb-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
          Dashboard
          <span className="mx-1.5 text-border">/</span>
          Observations
        </span>
      </div>

      {/* Title row */}
      <header className="anx-page-header-shell">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
          <div className="min-w-0 space-y-2">
            <h1 className="text-pretty text-[clamp(1.625rem,3.5vw,2rem)] font-bold leading-[1.1] tracking-[-0.035em] text-text">
              New Observation
            </h1>
            <p className="max-w-2xl text-pretty text-[0.9375rem] leading-relaxed text-muted/90">
              Institutional record for quality assurance and staff development.
            </p>
          </div>
          <div className="flex w-fit shrink-0 items-center gap-2 self-start rounded-full border border-[color-mix(in_srgb,var(--outline-variant)_30%,transparent)] bg-[var(--surface-container-lowest)] px-3.5 py-2 shadow-sm sm:self-auto">
            <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--warning)] ring-2 ring-[color-mix(in_srgb,var(--warning)_35%,transparent)]" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text">Draft Session</span>
          </div>
        </div>
      </header>

      {/* Step indicator: vertical on small screens (avoids cramped / misaligned horizontal strip) */}
      <div className="mt-8 hidden min-w-0 flex-wrap items-center gap-y-3 sm:flex">
        {STEPS.map((step, idx) => {
          const isActive = step.number === currentStep;
          const isCompleted = step.number < currentStep;
          const isLast = idx === STEPS.length - 1;

          return (
            <div key={step.number} className="flex min-w-0 items-center">
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[0.75rem] font-bold shadow-sm ${
                    isActive
                      ? "bg-[var(--tertiary-container)] text-[var(--on-primary)] ring-1 ring-[color-mix(in_srgb,var(--tertiary-container)_25%,#000)]"
                      : isCompleted
                      ? "bg-primary text-on-primary"
                      : "bg-[var(--surface-container-high)] text-muted"
                  }`}
                >
                  {isCompleted ? (
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    step.number
                  )}
                </span>
                <span
                  className={`whitespace-nowrap text-[0.8125rem] font-semibold tracking-[-0.01em] ${
                    isActive ? "text-text" : isCompleted ? "text-text" : "text-muted/70"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {!isLast && (
                <div
                  className={`mx-3 h-[2px] w-10 shrink-0 rounded-full sm:mx-4 sm:w-14 ${
                    isCompleted ? "bg-primary/35" : "bg-[color-mix(in_srgb,var(--outline-variant)_40%,transparent)]"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
      <ol className="mt-8 space-y-0 sm:hidden" aria-label="Observation steps">
        {STEPS.map((step) => {
          const isActive = step.number === currentStep;
          const isCompleted = step.number < currentStep;
          return (
            <li
              key={step.number}
              className={`flex items-center gap-3 border-l-[3px] py-2.5 pl-3 first:pt-0 last:pb-0 ${
                isActive
                  ? "border-[var(--tertiary-container)] bg-[color-mix(in_srgb,var(--tertiary-container)_08%,var(--surface-container-low))]"
                  : "border-transparent"
              }`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[0.75rem] font-bold shadow-sm ${
                  isActive
                    ? "bg-[var(--tertiary-container)] text-[var(--on-primary)]"
                    : isCompleted
                    ? "bg-primary text-on-primary"
                    : "bg-[var(--surface-container-high)] text-muted"
                }`}
              >
                {isCompleted ? (
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  step.number
                )}
              </span>
              <span
                className={`min-w-0 text-[0.8125rem] font-semibold tracking-[-0.01em] ${
                  isActive ? "text-text" : isCompleted ? "text-text" : "text-muted/70"
                }`}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>

      {/* Content */}
      <div className="mt-8">{children}</div>
    </div>
  );
}
