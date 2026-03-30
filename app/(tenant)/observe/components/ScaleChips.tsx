"use client";

type ScaleOption = { key: string; label: string; description: string };

export function ScaleChips({ options, value, disabled, onChange }: { options: ScaleOption[]; value: string; disabled?: boolean; onChange: (value: string) => void }) {
  const selected = options.find((o) => o.key === value);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.key}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option.key)}
            title={option.description}
            className={`calm-transition rounded-xl border px-3 py-1.5 text-xs font-medium disabled:opacity-40 ${
              value === option.key
                ? "border-accent/30 bg-primary text-on-primary shadow-sm hover:bg-primary-container active:bg-primary-container"
                : "border-border/60 bg-surface/80 text-text hover:border-border hover:bg-divider/50"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {selected?.description ? (
        <p className="text-[0.8125rem] leading-relaxed text-muted">{selected.description}</p>
      ) : null}
    </div>
  );
}
