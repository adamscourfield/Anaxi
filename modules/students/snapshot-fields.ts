// Anaxi field names used in the import mapping UI
export const ANAXI_FIELDS = [
  "UPN",
  "StudentName",
  "YearGroup",
  "AttendancePercent",
  "Lates",
  "Detentions",
  "InternalExclusions",
  "Suspensions",
  "PositivePoints",
  "NegativePoints",
  "SEND",
  "PP",
] as const;

export type AnaxiField = (typeof ANAXI_FIELDS)[number];

// Optional field – may be absent (use import date)
export const OPTIONAL_FIELDS = ["SnapshotDate", "CountScope"] as const;
export type OptionalField = (typeof OPTIONAL_FIELDS)[number];

export type AnyImportField = AnaxiField | OptionalField;

/** Common synonyms for fuzzy pre-fill of column mapping */
export const FIELD_SYNONYMS: Record<AnaxiField, string[]> = {
  UPN: ["UPN", "Unique Pupil Number", "upn"],
  StudentName: ["StudentName", "Name", "Pupil Name", "FullName", "Full Name", "Student Name"],
  YearGroup: ["Year", "YearGroup", "Year Group", "year_group"],
  AttendancePercent: ["Attendance", "Attendance%", "AttendancePercent", "attendance_pct", "Attendance Pct"],
  Lates: ["Lates", "Late", "LateCount", "Lateness"],
  Detentions: ["Detentions", "DetentionCount", "Detention"],
  InternalExclusions: ["InternalExclusions", "IE", "Internal Exclusion", "Internal Exclusions"],
  Suspensions: ["Suspensions", "FixedTerm", "Suspended", "Suspension"],
  PositivePoints: ["PositivePoints", "Merits", "Praise", "Rewards", "PositivePointsTotal", "Positives"],
  NegativePoints: ["NegativePoints", "Demerits", "NegativePointsTotal", "Negatives"],
  SEND: ["SEND", "SEN", "send"],
  PP: ["PP", "PupilPremium", "Pupil Premium", "pp"],
};

export const COUNTSCOPE_SYNONYMS = ["CountScope", "Count Scope", "Scope", "count_scope"];
export const SNAPSHOTDATE_SYNONYMS = ["SnapshotDate", "Snapshot Date", "Date", "snapshot_date", "ImportDate"];

/** Compute a normalised header signature for auto-matching saved mappings */
export function computeHeaderSignature(headers: string[]): string {
  return headers
    .map((h) => h.trim().toLowerCase())
    .sort()
    .join("|");
}

/** Attempt to auto-suggest a CSV header for each Anaxi field (case-insensitive) */
export function suggestMapping(headers: string[]): Partial<Record<AnyImportField, string>> {
  const lower = headers.map((h) => ({ original: h, lower: h.trim().toLowerCase() }));

  const findHeader = (synonyms: string[]) => {
    for (const syn of synonyms) {
      const found = lower.find((h) => h.lower === syn.toLowerCase());
      if (found) return found.original;
    }
    return undefined;
  };

  const result: Partial<Record<AnyImportField, string>> = {};

  for (const field of ANAXI_FIELDS) {
    const match = findHeader(FIELD_SYNONYMS[field]);
    if (match) result[field] = match;
  }

  const scopeMatch = findHeader(COUNTSCOPE_SYNONYMS);
  if (scopeMatch) result["CountScope"] = scopeMatch;

  const dateMatch = findHeader(SNAPSHOTDATE_SYNONYMS);
  if (dateMatch) result["SnapshotDate"] = dateMatch;

  return result;
}
