export type ArborStudentDestination = "PRIMARY" | "SECONDARY";
export type ArborStudentRouting = ArborStudentDestination | "SKIP_OFF_ROLL" | "REVIEW";

/**
 * Goresbrook's agreed routing rule: Reception to Year 6 belongs to Primary,
 * and Years 7 to 13 belong to Secondary. Anything else is left for review.
 */
export function routeArborStudentByAcademicLevel(
  academicLevel: string | null | undefined
): ArborStudentRouting {
  const value = academicLevel?.trim().toLowerCase() ?? "";
  if (!value) return "SKIP_OFF_ROLL";
  if (value === "reception" || value.startsWith("nursery")) return "PRIMARY";

  const match = value.match(/^(?:year|y)\s*0?([1-9]|1[0-3])$/);
  if (!match) return "REVIEW";

  const year = Number(match[1]);
  if (year >= 1 && year <= 6) return "PRIMARY";
  if (year >= 7 && year <= 13) return "SECONDARY";
  return "REVIEW";
}
