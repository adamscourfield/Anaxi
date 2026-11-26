/**
 * Attainment numbers are normalised scores (0–1) shown as a 0–100 index so different grade
 * scales can be compared. They are not percentages, so nothing here prints "%".
 */

/** 0.643 → "64.3" */
export function formatIndex(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return (value * 100).toFixed(1);
}

/** A change or difference on the index: 0.031 → "+3.1", -0.004 → "−0.4", 0 → "0.0". */
export function formatIndexChange(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const rounded = Math.round(value * 1000) / 10;
  if (rounded === 0) return "0.0";
  return (rounded > 0 ? "+" : "−") + Math.abs(rounded).toFixed(1);
}

/** Same as formatIndexChange with the unit, for sentences and summaries: "+3.1 points". */
export function formatIndexPoints(value: number | null | undefined): string {
  const text = formatIndexChange(value);
  if (text === "—") return text;
  return `${text} ${text === "+1.0" || text === "−1.0" ? "point" : "points"}`;
}

export type AttainmentTone = "concern" | "positive" | "neutral";

/** Value-add or movement: worth flagging only beyond ±5 index points. */
export function changeTone(value: number | null | undefined, threshold = 0.05): AttainmentTone {
  if (value === null || value === undefined) return "neutral";
  if (value <= -threshold) return "concern";
  if (value >= threshold) return "positive";
  return "neutral";
}

/** A SEND or PP gap (non-group mean minus group mean): a gap above 8 points is worth a look. */
export function gapTone(value: number | null | undefined, threshold = 0.08): AttainmentTone {
  if (value === null || value === undefined) return "neutral";
  return value > threshold ? "concern" : "neutral";
}

export function average(values: Array<number | null | undefined>): number | null {
  const present = values.filter((v): v is number => v !== null && v !== undefined && !Number.isNaN(v));
  if (!present.length) return null;
  return present.reduce((sum, v) => sum + v, 0) / present.length;
}
