/**
 * Tailwind arbitrary-value background classes for signal mean heatmap cells.
 * Means are on a ~1–4 observation rubric scale: higher = stronger practice.
 */
export function meanToHeatmapBarClass(mean: number | null | undefined): string {
  if (mean == null) {
    return "bg-[color-mix(in_srgb,var(--surface-container-high)_78%,var(--on-surface)_5%)]";
  }
  if (mean >= 3.5) {
    return "bg-[color-mix(in_srgb,var(--scale-strong-bar)_90%,#fff_10%)]";
  }
  if (mean >= 2.5) {
    return "bg-[color-mix(in_srgb,var(--scale-consistent-bar)_78%,#fff_22%)]";
  }
  if (mean >= 1.5) {
    return "bg-[color-mix(in_srgb,var(--scale-some-bar)_72%,#fff_28%)]";
  }
  return "bg-[color-mix(in_srgb,var(--scale-limited-bar)_85%,#fff_15%)]";
}

export function signalHeatmapCellTitle(label: string, mean: number | null | undefined): string {
  if (mean == null) {
    return `${label}: No data`;
  }
  return `${label}: ${mean.toFixed(2)} (1–4 scale; higher is stronger)`;
}
