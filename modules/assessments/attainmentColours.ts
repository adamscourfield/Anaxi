/**
 * Shared attainment / grade chroma — uses design-system tokens (scale-*, status-*, cat-*)
 * instead of Tailwind default palette (emerald-*, red-*, blue-50, etc.).
 */

/** GCSE numeric cell (1–9) — dark fills + on-primary for contrast */
export function gcseGradeBadgeClass(g: string | number | null): string {
  if (g === null) return "bg-surface-container-low text-muted";
  const n = Number(g);
  if (n >= 8) return "bg-scale-strong text-white";
  if (n >= 7) return "bg-scale-consistent text-white";
  if (n >= 6) return "bg-[var(--info)] text-white";
  if (n >= 5) return "bg-cat-violet-text text-white";
  if (n >= 4) return "bg-scale-some text-white";
  if (n >= 3) return "bg-[var(--warning)] text-[var(--warning-text)]";
  return "bg-scale-limited text-white";
}

/** A-Level letter cell */
export function aLevelGradeBadgeClass(g: string): string {
  switch (g.toUpperCase()) {
    case "A*":
      return "bg-scale-strong text-white";
    case "A":
      return "bg-scale-consistent text-white";
    case "B":
      return "bg-[var(--info)] text-white";
    case "C":
      return "bg-cat-violet-text text-white";
    case "D":
      return "bg-scale-some text-white";
    case "E":
      return "bg-[var(--warning)] text-[var(--warning-text)]";
    default:
      return "bg-scale-limited text-white";
  }
}

/** Percentage score badge (0–100) */
export function pctScoreBadgeClass(score: number): string {
  if (score >= 80) return "bg-scale-strong text-white";
  if (score >= 70) return "bg-scale-consistent text-white";
  if (score >= 60) return "bg-[var(--info)] text-white";
  if (score >= 50) return "bg-cat-violet-text text-white";
  if (score >= 40) return "bg-scale-some text-white";
  if (score >= 30) return "bg-[var(--warning)] text-[var(--warning-text)]";
  return "bg-scale-limited text-white";
}

/** Stacked distribution: high / low / mid bands (bar = light fill + dark text for in-bar labels) */
export function pctBandBarStyle(from: number, to: number): { bar: string; swatch: string } {
  if (from >= 70) return { bar: "bg-scale-strong-light text-scale-strong-text", swatch: "bg-scale-strong" };
  if (to <= 40) return { bar: "bg-scale-limited-light text-scale-limited-text", swatch: "bg-scale-limited" };
  return { bar: "bg-scale-consistent-light text-scale-consistent-text", swatch: "bg-scale-consistent-light" };
}

export function gradeDistributionBarStyle(
  grade: string,
  format: "GCSE" | "A_LEVEL",
): { bar: string; swatch: string } {
  if (format === "GCSE") {
    const n = Number(grade);
    if (!Number.isFinite(n)) {
      return { bar: "bg-surface-container-high text-[var(--on-surface-variant)]", swatch: "bg-surface-container-high" };
    }
    // Per-grade: light bar backgrounds + token text so labels are always readable in narrow segments.
    if (n === 9) return { bar: "bg-scale-strong-light text-scale-strong-text", swatch: "bg-scale-strong" };
    if (n === 8) return { bar: "bg-scale-strong-light text-scale-strong-text", swatch: "bg-scale-strong" };
    if (n === 7) return { bar: "bg-scale-consistent-bg text-scale-consistent-text", swatch: "bg-scale-consistent" };
    if (n === 6) return { bar: "bg-blue-8 text-[var(--info)]", swatch: "bg-[var(--info)]" };
    if (n === 5) return { bar: "bg-cat-violet-bg text-cat-violet-text", swatch: "bg-cat-violet-text" };
    if (n === 4) return { bar: "bg-scale-some-light text-scale-some-text", swatch: "bg-scale-some" };
    if (n === 3) return { bar: "bg-status-pending-light text-status-pending-text", swatch: "bg-[var(--warning)]" };
    if (n === 2) return { bar: "bg-scale-limited-light text-scale-limited-text", swatch: "bg-scale-limited" };
    if (n === 1) return { bar: "bg-status-denied-light text-status-denied-text", swatch: "bg-[var(--error)]" };
    return { bar: "bg-surface-container-high text-[var(--on-surface-variant)]", swatch: "bg-surface-container-high" };
  }
  const g = grade.toUpperCase();
  if (g === "A*" || g === "A") return { bar: "bg-scale-strong-light text-scale-strong-text", swatch: "bg-scale-strong" };
  if (g === "U" || g === "E") return { bar: "bg-scale-limited-light text-scale-limited-text", swatch: "bg-scale-limited" };
  return { bar: "bg-scale-consistent-light text-scale-consistent-text", swatch: "bg-scale-consistent-light" };
}

export function gapBadgeClass(gap: number): string {
  if (gap <= 5) return "bg-status-approved-light text-status-approved-text";
  if (gap <= 15) return "bg-scale-some-light text-scale-some-text";
  return "bg-status-denied-light text-status-denied-text";
}

export const metPillClass =
  "inline-flex items-center rounded-full bg-status-approved-light px-2 py-0.5 text-xs font-semibold text-status-approved-text";

export const notMetPillClass =
  "inline-flex items-center rounded-full bg-status-denied-light px-2 py-0.5 text-xs font-semibold text-status-denied-text";

/** Table header / numeric accent for GCSE threshold columns */
export const thresholdHeaderGcse = {
  t4: "text-scale-some-text",
  t5: "text-cat-violet-text",
  t7: "text-scale-consistent-text",
} as const;

export const thresholdHeaderALevel = {
  aStar: "text-scale-strong-text",
  aPlus: "text-scale-consistent-text",
  bPlus: "text-[var(--info)]",
  cPlus: "text-cat-violet-text",
} as const;

/** PP / SEND column accents */
export const ppNumericClass = "text-cat-violet-text";
export const sendNumericClass = "text-[var(--info)]";

/** Bar fills for ranking / comparison */
export const barPositiveClass = "bg-scale-strong";
export const barNegativeClass = "bg-scale-limited";
export const barNeutralClass = "bg-scale-consistent-light";

/** Small legend swatches */
export const swatchLowClass = "bg-scale-limited";
export const swatchMidClass = "bg-scale-consistent-light";
export const swatchHighClass = "bg-scale-strong";

/** PP / SEND micro-badges (inline) */
export const ppInlineBadgeClass =
  "rounded-full bg-cat-violet-bg px-1 text-[9px] font-semibold text-cat-violet-text";
export const ppInlineBadgeClassLg =
  "rounded-full bg-cat-violet-bg px-1.5 text-[9px] font-semibold text-cat-violet-text";
export const sendInlineBadgeClass =
  "rounded-full bg-cat-blue-bg px-1 text-[9px] font-semibold text-cat-blue-text";
export const sendInlineBadgeClassLg =
  "rounded-full bg-cat-blue-bg px-1.5 text-[9px] font-semibold text-cat-blue-text";
export const sendTableBadgeClass =
  "rounded bg-cat-blue-bg px-1.5 py-0.5 text-[10px] font-semibold uppercase text-cat-blue-text";
export const ppTableBadgeClass =
  "rounded bg-cat-violet-bg px-1.5 py-0.5 text-[10px] font-semibold uppercase text-cat-violet-text";

/** Bar fills for PP / SEND mean comparison strips */
export const ppBarFillClass = "bg-cat-violet-text";
export const sendBarFillClass = "bg-[var(--info)]";

/** A-Level summary horizontal bar segments */
export const aLevelBarClasses = {
  aStar: "bg-scale-strong",
  a: "bg-scale-consistent",
  b: "bg-[var(--info)]",
  cPlus: "bg-cat-violet-text",
} as const;

/** EM / basics progress fill */
export const emProgressFillClass = "bg-scale-strong";

/** Point-type pills (soft, on light surfaces) */
export const pointTypePillClasses: Record<string, string> = {
  BASELINE: "bg-surface-container text-muted",
  INTERNAL_ASSESSMENT: "bg-cat-blue-bg text-cat-blue-text",
  INTERNAL_MOCK: "bg-scale-some-light text-scale-some-text",
  TEACHER_PREDICTION: "bg-cat-violet-bg text-cat-violet-text",
  EXTERNAL_FINAL: "bg-status-approved-light text-status-approved-text",
  OTHER: "bg-surface-container text-muted",
};

/** Result status pills (soft) */
export const resultStatusPillClasses: Record<string, string> = {
  DRAFT: "bg-surface-container text-muted",
  VALIDATED: "bg-cat-blue-bg text-cat-blue-text",
  PUBLISHED: "bg-status-approved-light text-status-approved-text",
  LOCKED: "bg-primary text-on-primary",
};

/** Qualification type on cycles list */
export const qualificationTypePillClasses: Record<string, string> = {
  GCSE: "bg-cat-blue-bg text-cat-blue-text",
  A_LEVEL: "bg-cat-violet-bg text-cat-violet-text",
  PERCENTAGE: "bg-status-approved-light text-status-approved-text",
  OTHER: "bg-surface-container text-muted",
};

/** Final / highlight chip */
export const finalPointChipClass =
  "rounded-full bg-status-approved-light px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-status-approved-text";

/** Triangulation row — PP vs SEND labels (corrected: PP violet, SEND blue) */
export const triangulationPpClass =
  "rounded-full bg-cat-violet-bg px-2 py-0.5 text-[10px] font-semibold text-cat-violet-text";
export const triangulationSendClass =
  "rounded-full bg-cat-blue-bg px-2 py-0.5 text-[10px] font-semibold text-cat-blue-text";
