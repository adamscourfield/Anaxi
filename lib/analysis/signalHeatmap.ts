/**
 * Tailwind background classes for signal mean heatmap cells.
 * Means are on a ~1–4 observation rubric scale: higher = stronger practice.
 *
 * Uses theme tokens from tailwind.config (scale-*-bar) so classes are always
 * generated; arbitrary-value bg-[color-mix(...)] in this file was not scanned
 * when `lib/` was omitted from Tailwind `content`, which left cells invisible.
 */
export function meanToHeatmapBarClass(mean: number | null | undefined): string {
  if (mean == null) {
    return "bg-surface-container-high";
  }
  if (mean >= 3.5) {
    return "bg-scale-strong-bar";
  }
  if (mean >= 2.5) {
    return "bg-scale-consistent-bar";
  }
  if (mean >= 1.5) {
    return "bg-scale-some-bar";
  }
  return "bg-scale-limited-bar";
}

export function signalHeatmapCellTitle(label: string, mean: number | null | undefined): string {
  if (mean == null) {
    return `${label}: No data`;
  }
  return `${label}: ${mean.toFixed(2)} (1–4 scale; higher is stronger)`;
}
