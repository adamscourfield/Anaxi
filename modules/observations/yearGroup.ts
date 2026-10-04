/**
 * Format a stored year-group code (e.g. "Y7") into a human-readable
 * label (e.g. "Year 7").
 */
export function formatYearGroup(yg: string | null | undefined): string {
  const value = yg?.trim();
  if (!value) return "—";

  // Arbor and historic imports use a mixture of Y7, 7, and Year 7.
  const match = value.match(/^(?:year\s*|y\s*)?(\d{1,2})$/i);
  return match ? `Year ${match[1]}` : value;
}
