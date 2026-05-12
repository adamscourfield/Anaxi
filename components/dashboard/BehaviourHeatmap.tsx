import Link from "next/link";

export type BehaviourHeatmapProps = {
  /**
   * Ordered list of year-group labels (rows), e.g. ["Year 7", "Year 8", ...].
   */
  yearGroups: string[];
  /**
   * Ordered list of column labels, e.g. ["Mon", "Tue", "Wed", "Thu", "Fri"].
   * Matches the column dimension of `matrix`.
   */
  columnLabels: string[];
  /**
   * matrix[yearGroupIndex][columnIndex] = incident count (integer ≥ 0).
   */
  matrix: number[][];
  ctaHref?: string;
  ctaLabel?: string;
};

/** Map a value in [0, maxVal] to a coral opacity 0–1, clamped to [0.06, 0.88]. */
function coralOpacity(value: number, maxVal: number): number {
  if (maxVal === 0) return 0.06;
  const t = Math.min(value / maxVal, 1);
  // Use a gentle curve so low values still have a visible tint
  return 0.06 + t * 0.82;
}

/** Text colour — dark on light cells, white on dark cells */
function cellTextClass(opacity: number): string {
  return opacity > 0.52 ? "text-[#3d060b]" : "text-[var(--on-surface-variant)]";
}

export function BehaviourHeatmap({
  yearGroups,
  columnLabels,
  matrix,
  ctaHref = "/students",
  ctaLabel = "View full map",
}: BehaviourHeatmapProps) {
  // Find global max for colour scale
  const allValues = matrix.flatMap((row) => row);
  const maxVal = Math.max(...allValues, 1);

  return (
    <div className="flex h-full flex-col gap-5">
      {/* Header */}
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--surface-container)] text-muted [&_svg]:h-4 [&_svg]:w-4">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-bold tracking-[-0.01em] text-text">Behaviour heatmap</h2>
            <p className="mt-0.5 text-xs text-muted">Disruption incidents by year group</p>
          </div>
        </div>
        <Link
          href={ctaHref}
          className="shrink-0 text-xs font-semibold text-muted calm-transition hover:text-text"
        >
          View full map →
        </Link>
      </div>

      {/* Heatmap grid */}
      <div className="flex-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <table className="w-full min-w-[360px] border-collapse text-xs" aria-label="Behaviour heatmap by year group">
          <thead>
            <tr>
              {/* Empty corner */}
              <th scope="col" className="w-16 pb-2 pr-2 text-left" />
              {columnLabels.map((label, ci) => (
                <th
                  key={ci}
                  scope="col"
                  className="pb-2 text-center font-medium text-muted"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {yearGroups.map((yg, ri) => (
              <tr key={yg}>
                <th
                  scope="row"
                  className="py-1 pr-3 text-left text-[11px] font-medium text-muted"
                >
                  {yg}
                </th>
                {(matrix[ri] ?? []).map((val, ci) => {
                  const opacity = coralOpacity(val, maxVal);
                  const textClass = cellTextClass(opacity);
                  return (
                    <td key={ci} className="p-0.5">
                      <div
                        className={`flex h-8 min-w-[2rem] items-center justify-center rounded-[5px] text-[11px] font-semibold tabular-nums transition-opacity ${textClass}`}
                        style={{ background: `rgba(254,159,159,${opacity})` }}
                        title={`${yg} — ${columnLabels[ci]}: ${val} incident${val !== 1 ? "s" : ""}`}
                      >
                        {val > 0 ? val : ""}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend + CTA row */}
      <div className="flex items-center justify-between gap-4">
        {/* Colour scale legend */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium text-muted">Low disruption</span>
          <div className="flex h-3 w-20 overflow-hidden rounded-sm">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="flex-1"
                style={{ background: `rgba(254,159,159,${0.06 + (i / 7) * 0.82})` }}
              />
            ))}
          </div>
          <span className="text-[10px] font-medium text-muted">High disruption</span>
        </div>

        <Link
          href={ctaHref}
          className="shrink-0 text-sm font-semibold text-text calm-transition hover:text-muted"
        >
          {ctaLabel} →
        </Link>
      </div>
    </div>
  );
}
