"use client";

const STEPS = [
  { number: 1, label: "Session Details" },
  { number: 2, label: "Criteria & Metrics" },
  { number: 3, label: "Review & Submit" },
];

/** Wizard chrome (breadcrumb, title, steps) without max-width — pair with full-width review content. */
export function ReviewStageChrome({
  currentStep = 3,
  children,
}: {
  currentStep?: 1 | 2 | 3;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full min-w-0 max-w-full">
      <div className="mb-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6B7280]">
          Dashboard
          <span className="mx-1.5 text-[#E5E7EB]">/</span>
          Observations
        </span>
      </div>

      <header className="rounded-xl border border-[#E5E7EB] bg-white px-5 py-5 shadow-sm sm:px-6 sm:py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
          <div className="min-w-0 space-y-2">
            <h1 className="text-pretty text-[clamp(1.625rem,3.5vw,2rem)] font-bold leading-[1.1] tracking-[-0.035em] text-[#111827]">
              New Observation
            </h1>
            <p className="max-w-2xl text-pretty text-[0.9375rem] leading-relaxed text-[#6B7280]">
              Institutional record for quality assurance and staff development.
            </p>
          </div>
          <div className="flex w-fit shrink-0 items-center gap-2 self-start rounded-md border border-[#E5E7EB] bg-[#F9FAFB] px-3.5 py-2 shadow-sm sm:self-auto">
            <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400 ring-2 ring-amber-400/30" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#111827]">Draft Session</span>
          </div>
        </div>
      </header>

      <div className="mt-8 hidden min-w-0 flex-wrap items-center gap-y-3 sm:flex">
        {STEPS.map((step, idx) => {
          const isActive = step.number === currentStep;
          const isCompleted = step.number < currentStep;
          const isLast = idx === STEPS.length - 1;

          return (
            <div key={step.number} className="flex min-w-0 items-center">
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[0.75rem] font-bold shadow-sm ${
                    isActive
                      ? "bg-[#1F2937] text-white ring-1 ring-black/10"
                      : isCompleted
                      ? "bg-[#111827] text-white"
                      : "bg-[#E5E7EB] text-[#6B7280]"
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
                    isActive ? "text-[#111827]" : isCompleted ? "text-[#111827]" : "text-[#6B7280]/70"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {!isLast && (
                <div
                  className={`mx-3 h-[2px] w-10 shrink-0 rounded-md sm:mx-4 sm:w-14 ${
                    isCompleted ? "bg-[#111827]/25" : "bg-[#E5E7EB]"
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
                isActive ? "border-[#1F2937] bg-[#F3F4F6]" : "border-transparent"
              }`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[0.75rem] font-bold shadow-sm ${
                  isActive ? "bg-[#1F2937] text-white" : isCompleted ? "bg-[#111827] text-white" : "bg-[#E5E7EB] text-[#6B7280]"
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
                  isActive ? "text-[#111827]" : isCompleted ? "text-[#111827]" : "text-[#6B7280]/70"
                }`}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="mt-8">{children}</div>
    </div>
  );
}
