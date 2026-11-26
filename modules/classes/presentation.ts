import { formatYearGroup } from "@/lib/yearGroup";
export const defaultClassLabels = {
  positive: "Positive Points", negative: "Negative Points", detention: "Detentions",
  onCall: "On Calls", internalExclusion: "Internal Exclusions", suspension: "Suspensions", lateness: "Late arrivals",
};
export type ClassLabels = typeof defaultClassLabels;

/** "Y7" → "Year 7"; "Y10 / Y11" → "Years 10 and 11". */
export function formatYearGroups(yearGroup: string): string {
  const parts = yearGroup.split("/").map((p) => p.trim()).filter(Boolean);
  if (!parts.length || parts.every((p) => p === "Unassigned")) return "No year group";
  return formatYearGroup(parts.join(", "));
}
