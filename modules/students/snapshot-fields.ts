import { pluralLabel } from "@/lib/vocab";

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
  "SEND",
  "PP",
] as const;

export type AnaxiField = (typeof ANAXI_FIELDS)[number];

// Optional field – may be absent (use import date)
export const OPTIONAL_FIELDS = ["SnapshotDate"] as const;
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
  SEND: ["SEND", "SEN", "send"],
  PP: ["PP", "PupilPremium", "Pupil Premium", "pp"],
};

export const SNAPSHOTDATE_SYNONYMS = ["SnapshotDate", "Snapshot Date", "Date", "snapshot_date", "ImportDate"];

/** A tenant's customized wording for the behaviour labels that appear in the import mapping UI. */
export type TenantBehaviourLabels = {
  positivePointsLabel?: string | null;
  detentionLabel?: string | null;
  internalExclusionLabel?: string | null;
  suspensionLabel?: string | null;
};

/** Human-readable label for each import field, using the tenant's own terminology where one is set. */
export function getAnaxiFieldLabels(tenantSettings?: TenantBehaviourLabels | null): Record<AnaxiField, string> {
  return {
    UPN: "UPN",
    StudentName: "Student name",
    YearGroup: "Year group",
    AttendancePercent: "Attendance %",
    Lates: "Lateness",
    Detentions: pluralLabel(tenantSettings?.detentionLabel || "Detention"),
    InternalExclusions: pluralLabel(tenantSettings?.internalExclusionLabel || "Internal Exclusion"),
    Suspensions: pluralLabel(tenantSettings?.suspensionLabel || "Suspension"),
    PositivePoints: pluralLabel(tenantSettings?.positivePointsLabel || "Positive Points"),
    SEND: "SEND",
    PP: "Pupil premium",
  };
}

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

  const dateMatch = findHeader(SNAPSHOTDATE_SYNONYMS);
  if (dateMatch) result["SnapshotDate"] = dateMatch;

  return result;
}
