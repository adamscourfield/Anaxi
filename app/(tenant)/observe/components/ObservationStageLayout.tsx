"use client";

const STEPS = [
  { number: 1, label: "Session Details" },
  { number: 2, label: "Criteria & Metrics" },
  { number: 3, label: "Review & Submit" },
];

export function ObservationStageLayout({
  currentStep,
  children,
  maxWidthClassName = "max-w-4xl",
}: {
  currentStep: 1 | 2 | 3;
  children: React.ReactNode;
  /** Wider layout for review step two-column content */
  maxWidthClassName?: string;
}) {
  return (
    <div className={`mx-auto pb-12 ${maxWidthClassName}`}>
      {/* Breadcrumb */}
      <div className="mb-1">
        <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
          Dashboard
          <span className="mx-1.5 text-border">/</span>
          Observations
        </span>
      </div>

      {/* Title row */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[1.75rem] font-bold tracking-tight text-text">New Observation</h1>
          <p className="mt-1 text-[0.9375rem] text-muted">
            Institutional record for quality assurance and staff development.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-full border border-border/40 bg-surface-container-lowest/80 px-3.5 py-1.5">
          <span className="h-2 w-2 rounded-full bg-scale-some-bar" />
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-text">
            Draft Session
          </span>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="mt-6 flex items-center gap-0">
        {STEPS.map((step, idx) => {
          const isActive = step.number === currentStep;
          const isCompleted = step.number < currentStep;
          const isLast = idx === STEPS.length - 1;

          return (
            <div key={step.number} className="flex items-center">
              <div className="flex items-center gap-2.5">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-[0.75rem] font-bold ${
                    isActive
                      ? "bg-primary text-on-primary"
                      : isCompleted
                      ? "bg-primary text-on-primary"
                      : "bg-surface-container text-muted"
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
                  className={`text-[0.8125rem] font-medium ${
                    isActive ? "text-text" : isCompleted ? "text-text" : "text-muted/60"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {!isLast && (
                <div
                  className={`mx-4 h-[2px] w-16 rounded-full ${
                    isCompleted ? "bg-primary" : "bg-border/40"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Content */}
      <div className="mt-8">{children}</div>
    </div>
  );
}
