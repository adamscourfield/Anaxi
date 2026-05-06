"use client";

const SCALE_COLORS: Record<string, { border: string; label: string; dot: string }> = {
  "Limited evidence": { border: "border-scale-limited-border", label: "text-scale-limited-text", dot: "bg-scale-limited-bar" },
  "Some evidence":    { border: "border-scale-some-border",    label: "text-scale-some-text",    dot: "bg-scale-some-bar" },
  "Consistent":       { border: "border-scale-consistent-border", label: "text-scale-consistent-text", dot: "bg-scale-consistent-bar" },
  "Strong & embedded":{ border: "border-scale-strong-border",  label: "text-scale-strong-text",  dot: "bg-scale-strong-bar" },
};

export function SignalHelpSheet({
  open,
  onClose,
  description,
  lookFors,
  scaleRows,
}: {
  open: boolean;
  onClose: () => void;
  description: string;
  lookFors?: string[];
  scaleRows: { label: string; guidance: string }[];
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-t-2xl glass-card shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar (mobile) */}
        <div className="flex justify-center pb-0 pt-3 sm:hidden">
          <div className="h-1 w-10 rounded-md bg-border" />
        </div>

        <div className="max-h-[80vh] overflow-y-auto p-6">
          {/* Description */}
          <div className="mb-5">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">About this signal</p>
            <p className="mt-2 text-[0.9375rem] leading-relaxed text-text">{description}</p>
          </div>

          {/* Look-fors */}
          {lookFors && lookFors.length > 0 && (
            <div className="mb-5">
              <p className="mb-2.5 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">What to look for</p>
              <ul className="space-y-1.5">
                {lookFors.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-[0.875rem] text-text">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Scale guidance */}
          <div>
            <p className="mb-2.5 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">Rating guidance</p>
            <div className="space-y-2">
              {scaleRows.map((row, idx) => {
                const color = SCALE_COLORS[row.label] ?? { border: "border-border", label: "text-text", dot: "bg-outline-variant" };
                return (
                  <div
                    key={row.label}
                    className={`rounded-xl border p-3.5 ${color.border}`}
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${color.dot}`} />
                      <span className={`text-[0.8125rem] font-semibold ${color.label}`}>
                        {idx + 1} — {row.label}
                      </span>
                    </div>
                    <p className="text-[0.8125rem] leading-relaxed text-muted">{row.guidance}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="border-t border-border/30 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-accent py-2.5 text-[0.875rem] font-semibold text-on-primary calm-transition hover:bg-accentHover"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
