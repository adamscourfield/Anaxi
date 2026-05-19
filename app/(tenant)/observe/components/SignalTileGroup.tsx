"use client";

type ScaleOption = {
  key: string;
  label: string;
  guidance?: string;
};

const LEVEL_LABELS: Record<string, string> = {
  LIMITED:    "Limited",
  SOME:       "Some",
  CONSISTENT: "Consistent",
  STRONG:     "Strong",
};

export function SignalTileGroup({
  options,
  selected,
  onSelect,
}: {
  options: ScaleOption[];
  selected: string | null;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {options.map((option, idx) => {
        const isSelected = selected === option.key;
        const label = LEVEL_LABELS[option.key] ?? option.label;

        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onSelect(option.key)}
            className={`relative w-full rounded-2xl p-5 text-left calm-transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent border ${
              isSelected
                ? "bg-tertiary-container border-tertiary-container"
                : "bg-surface-container-lowest border-border/40 hover:bg-surface-container-low hover:border-border"
            }`}
          >
            {/* Top row: Level badge + radio/check circle */}
            <div className="mb-3 flex items-center justify-between">
              <span
                className={`rounded-md px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-widest ${
                  isSelected
                    ? "bg-[var(--surface-container-lowest)]/10 text-on-tertiary-container"
                    : "bg-surface-container text-muted"
                }`}
              >
                Level {idx + 1}
              </span>
              <div
                className={`flex h-5 w-5 items-center justify-center rounded-md border-2 ${
                  isSelected
                    ? "border-on-tertiary-container/40 bg-[var(--surface-container-lowest)]/10"
                    : "border-border/60 bg-transparent"
                }`}
              >
                {isSelected && (
                  <svg
                    className="h-3 w-3 text-on-tertiary-container"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="10 3 5 8.5 2 6" />
                  </svg>
                )}
              </div>
            </div>

            {/* Title */}
            <p
              className={`text-[1rem] font-bold leading-tight ${
                isSelected ? "text-on-tertiary-container" : "text-text"
              }`}
            >
              {label}
            </p>

            {/* Guidance description */}
            {option.guidance && (
              <p
                className={`mt-1.5 text-[0.8125rem] leading-relaxed ${
                  isSelected ? "text-tertiary-fixed" : "text-muted"
                }`}
              >
                {option.guidance}
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}
