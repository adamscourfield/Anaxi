/**
 * Year groups: one way to store them, one way to show them.
 *
 * Stored  "Y7", "Y11", "R" (Reception), "N" (Nursery). Arbor sync already writes these.
 * Shown   "Year 7", "Year 11", "Reception", "Nursery".
 *
 * Imports and older records also hold "7", "07", "Year 7", "Yr 7", "y7", "Rec".
 * normalizeYearGroup() turns any of those into the stored form; formatYearGroup()
 * turns any of them into the label people see.
 */

const MAX_YEAR = 14;

/** The stored code for a single year group, or null when the value isn't a recognisable year. */
export function canonicalYearGroup(value: string | null | undefined): string | null {
  const raw = value?.trim().toLowerCase() ?? "";
  if (!raw) return null;
  if (raw === "n" || raw === "nur" || raw.startsWith("nursery")) return "N";
  if (raw === "r" || raw === "rec" || raw === "reception" || raw === "yr r" || raw === "year r") return "R";
  const match = raw.match(/^(?:year|yr|y)?\s*0?(\d{1,2})$/);
  if (!match) return null;
  const n = Number(match[1]);
  return n >= 1 && n <= MAX_YEAR ? `Y${n}` : null;
}

/**
 * What to store. Recognised years become their code; a list like "Y7, Year 8" becomes "Y7, Y8";
 * anything else is kept as typed (trimmed) rather than thrown away.
 */
export function normalizeYearGroup(value: string | null | undefined): string | null {
  const raw = value?.trim() ?? "";
  if (!raw) return null;
  if (/[,/]/.test(raw)) {
    const parts = raw.split(/\s*[,/]\s*/).filter(Boolean);
    return parts.map((p) => canonicalYearGroup(p) ?? p).join(", ");
  }
  return canonicalYearGroup(raw) ?? raw;
}

/** The label people see: "Year 8", "Reception", "Years 7, 8 and 9". */
export function formatYearGroup(value: string | null | undefined): string {
  const raw = value?.trim() ?? "";
  if (!raw) return "—";
  if (/[,/]/.test(raw)) {
    const codes = raw.split(/\s*[,/]\s*/).filter(Boolean).map((p) => canonicalYearGroup(p) ?? p);
    const numbers = codes.map((c) => /^Y(\d+)$/.exec(c)?.[1]);
    if (numbers.every(Boolean)) {
      const list = numbers as string[];
      if (list.length === 1) return `Year ${list[0]}`;
      return `Years ${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
    }
    return codes.map((c) => formatYearGroup(c)).join(", ");
  }
  const code = canonicalYearGroup(raw);
  if (code === "R") return "Reception";
  if (code === "N") return "Nursery";
  if (code) return `Year ${code.slice(1)}`;
  return raw;
}

/** Sort Nursery, Reception, Year 1 … Year 14, then anything unrecognised. */
export function yearGroupSortKey(value: string | null | undefined): number {
  const code = canonicalYearGroup(value);
  if (code === "N") return -2;
  if (code === "R") return -1;
  if (code) return Number(code.slice(1));
  return 100;
}

export function compareYearGroups(a: string | null | undefined, b: string | null | undefined): number {
  return yearGroupSortKey(a) - yearGroupSortKey(b) || String(a ?? "").localeCompare(String(b ?? ""));
}
