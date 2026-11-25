export const defaultClassLabels = {
  positive: "Positive Points", negative: "Negative Points", detention: "Detentions",
  onCall: "On Calls", internalExclusion: "Internal Exclusions", suspension: "Suspensions", lateness: "Late arrivals",
};
export type ClassLabels = typeof defaultClassLabels;

/** "Y7" → "Year 7"; "Y10 / Y11" → "Years 10 and 11". */
export function formatYearGroups(yearGroup: string): string {
  const parts = yearGroup.split("/").map((p) => p.trim()).filter(Boolean);
  const nums = parts.map((p) => p.match(/\d+/)?.[0] ?? p);
  if (!nums.length || parts.every((p) => p === "Unassigned")) return "No year group";
  if (nums.length === 1) return /^\d+$/.test(nums[0]) ? `Year ${nums[0]}` : nums[0];
  return `Years ${nums.slice(0, -1).join(", ")} and ${nums[nums.length - 1]}`;
}
