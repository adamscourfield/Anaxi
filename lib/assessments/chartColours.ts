/**
 * Shared grade / chart colour classes using design tokens (avoid raw Tailwind palette drift).
 */

/** GCSE numeric 1–9 cell backgrounds (high → low). */
export function gcseNumericCellClass(g: string | number | null): string {
  if (g === null) return "bg-surface-container-low text-muted";
  const n = Number(g);
  if (n >= 8) return "bg-scale-strong text-white";
  if (n >= 7) return "bg-scale-consistent text-white";
  if (n >= 6) return "bg-cat-blue-text text-white";
  if (n >= 5) return "bg-cat-violet-text text-white";
  if (n >= 4) return "bg-scale-some text-white";
  if (n >= 3) return "bg-scale-limited text-white";
  return "bg-error text-white";
}

/** A-level letter grade cell backgrounds. */
export function aLevelLetterCellClass(g: string): string {
  switch (g.toUpperCase()) {
    case "A*":
      return "bg-scale-strong text-white";
    case "A":
      return "bg-scale-consistent text-white";
    case "B":
      return "bg-cat-blue-text text-white";
    case "C":
      return "bg-cat-violet-text text-white";
    case "D":
      return "bg-scale-some text-white";
    case "E":
      return "bg-scale-limited text-white";
    default:
      return "bg-error text-white";
  }
}

/** Percentile / raw score bands. */
export function percentileCellClass(score: number): string {
  if (score >= 80) return "bg-scale-strong text-white";
  if (score >= 70) return "bg-scale-consistent text-white";
  if (score >= 60) return "bg-cat-blue-text text-white";
  if (score >= 50) return "bg-cat-violet-text text-white";
  if (score >= 40) return "bg-scale-some text-white";
  if (score >= 30) return "bg-scale-limited text-white";
  return "bg-error text-white";
}

/** Bar fill for positive vs negative delta (e.g. vs year mean). */
export function deltaBarClass(positive: boolean): string {
  return positive ? "bg-positive" : "bg-negative";
}

/** Neutral / mid band for distribution bars. */
export function pctBandDistributionStyle(from: number, to: number): { bar: string; swatch: string } {
  if (from >= 70) return { bar: "bg-scale-strong text-white", swatch: "bg-scale-strong" };
  if (to <= 40) return { bar: "bg-negative text-white", swatch: "bg-negative" };
  return { bar: "bg-cat-indigo-bg text-cat-indigo-text", swatch: "bg-cat-indigo-bg" };
}

export function gradeDistributionBarStyle(
  grade: string,
  format: "GCSE" | "A_LEVEL",
): { bar: string; swatch: string } {
  if (format === "GCSE") {
    const n = Number(grade);
    if (Number.isFinite(n) && n >= 8) return { bar: "bg-scale-strong text-white", swatch: "bg-scale-strong" };
    if (Number.isFinite(n) && n <= 2) return { bar: "bg-negative text-white", swatch: "bg-negative" };
    return { bar: "bg-cat-indigo-bg text-cat-indigo-text", swatch: "bg-cat-indigo-bg" };
  }
  const g = grade.toUpperCase();
  if (g === "A*" || g === "A") return { bar: "bg-scale-strong text-white", swatch: "bg-scale-strong" };
  if (g === "U" || g === "E") return { bar: "bg-negative text-white", swatch: "bg-negative" };
  return { bar: "bg-cat-indigo-bg text-cat-indigo-text", swatch: "bg-cat-indigo-bg" };
}

/** SEND / cohort comparison accent (second series). */
export const SERIES_ALT_BAR_CLASS = "bg-blue";

/** Qualification type (cycle level). */
export const QUALIFICATION_TYPE_BADGE: Record<string, string> = {
  GCSE: "bg-cat-blue-bg text-cat-blue-text",
  A_LEVEL: "bg-cat-violet-bg text-cat-violet-text",
  PERCENTAGE: "bg-scale-strong-light text-scale-strong-text",
  OTHER: "bg-surface-container text-on-surface-variant",
};

/** Point type labels (internal vs external). */
export const POINT_TYPE_BADGE: Record<string, string> = {
  GCSE: "bg-cat-blue-bg text-cat-blue-text",
  A_LEVEL: "bg-cat-violet-bg text-cat-violet-text",
  PERCENTAGE: "bg-scale-strong-light text-scale-strong-text",
  RAW: "bg-cat-indigo-bg text-cat-indigo-text",
  INTERNAL_ASSESSMENT: "bg-cat-blue-bg text-cat-blue-text",
  EXTERNAL_FINAL: "bg-scale-strong-light text-scale-strong-text",
};

/** Result point `pointType` on snapshot (full enum used on point detail). */
export const RESULT_POINT_TYPE_BADGE: Record<string, string> = {
  BASELINE: "bg-surface-container text-on-surface-variant",
  INTERNAL_ASSESSMENT: "bg-cat-blue-bg text-cat-blue-text",
  INTERNAL_MOCK: "bg-scale-some-light text-scale-some-text",
  TEACHER_PREDICTION: "bg-cat-violet-bg text-cat-violet-text",
  EXTERNAL_FINAL: "bg-scale-strong-light text-scale-strong-text",
  OTHER: "bg-surface-container text-on-surface-variant",
};

/** Result point lifecycle. */
export const RESULT_STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-surface-container-high text-on-surface-variant",
  VALIDATED: "bg-cat-blue-bg text-cat-blue-text",
  PUBLISHED: "bg-scale-strong-light text-scale-strong-text",
  LOCKED: "bg-primary text-on-primary",
};

/** Small SEN/SEND tag. */
export const SEN_TAG_CLASS = "bg-pill-info-bg text-pill-info-text";

/** Pupil premium bar (second cohort series). */
export const PP_SERIES_BAR_CLASS = "bg-cat-violet-text";

/** Pupil premium tag. */
export const PP_TAG_CLASS = "bg-cat-purple-bg text-cat-purple-text";

/** Soft badge: gap or threshold (green / amber / red using tokens). */
export function gapBadgeSoftClass(gap: number): string {
  if (gap <= 5) return "bg-scale-strong-light text-scale-strong-text";
  if (gap <= 15) return "bg-scale-some-light text-scale-some-text";
  return "bg-scale-limited-light text-scale-limited-text";
}
