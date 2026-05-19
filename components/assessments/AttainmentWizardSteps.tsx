"use client";

export type AttainmentWizardStep = {
  id: string;
  label: string;
};

type Props = {
  steps: AttainmentWizardStep[];
  currentId: string;
  className?: string;
};

/** Shared step indicator for attainment setup wizards (new cycle, upload). */
export function AttainmentWizardSteps({ steps, currentId, className = "" }: Props) {
  const currentIndex = Math.max(0, steps.findIndex((s) => s.id === currentId));
  const pct = steps.length <= 1 ? 100 : Math.round((currentIndex / (steps.length - 1)) * 100);

  return (
    <nav aria-label="Progress" className={`space-y-3 ${className}`.trim()}>
      <ol className="flex flex-wrap items-center gap-2">
        {steps.map((step, i) => {
          const done = i < currentIndex;
          const active = step.id === currentId;
          return (
            <li key={step.id} className="flex items-center gap-2">
              {i > 0 ? (
                <span className="text-muted" aria-hidden>
                  →
                </span>
              ) : null}
              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm ${
                  active
                    ? "bg-[var(--secondary-container)] font-semibold text-text"
                    : "text-muted"
                }`}
                aria-current={active ? "step" : undefined}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    active
                      ? "bg-[var(--on-surface)] text-[var(--surface-bright)]"
                      : done
                        ? "bg-[var(--pill-success-bg)] text-[var(--pill-success-text)]"
                        : "bg-[var(--surface-container-high)] text-muted"
                  }`}
                >
                  {done ? "✓" : i + 1}
                </span>
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
      <div
        aria-hidden
        className="h-1 w-full overflow-hidden rounded-full bg-[var(--surface-container-high)]"
      >
        <div
          className="h-full rounded-full bg-[var(--on-surface)] calm-transition"
          style={{ width: `${Math.max(8, pct)}%` }}
        />
      </div>
    </nav>
  );
}
