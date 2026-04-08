import { parse } from "csv-parse/sync";
import { AnaxiField } from "./snapshot-fields";

export type CountScope =
  | "ROLLING_21_DAYS"
  | "ROLLING_28_DAYS"
  | "TERM_TO_DATE"
  | "YEAR_TO_DATE";

export interface SnapshotMapping {
  /** Maps each AnaxiField to the CSV column header */
  fieldMap: Partial<Record<AnaxiField, string>>;
  /** CSV column holding CountScope, or null if using fixedCountScope */
  countScopeColumn?: string | null;
  /** Fixed CountScope applied to all rows when no column mapped */
  fixedCountScope?: CountScope | null;
  /** CSV column holding SnapshotDate; if absent, importDate is used */
  snapshotDateColumn?: string | null;
}

export interface SnapshotRow {
  upn: string;
  studentName: string;
  yearGroup: string;
  attendancePercent: number;
  lates: number;
  detentions: number;
  internalExclusions: number;
  suspensions: number;
  positivePoints: number;
  negativePoints: number;
  send: boolean;
  pp: boolean;
  countScope: CountScope;
  snapshotDate: Date;
}

export interface RowError {
  rowNumber: number;
  upn: string;
  studentName: string;
  yearGroup: string;
  errorCode: string;
  message: string;
}

export interface ParseResult {
  rows: SnapshotRow[];
  errors: RowError[];
}

// ── coercion helpers ──────────────────────────────────────────────────────────

export function parseBoolean(raw: string): boolean {
  const v = String(raw ?? "")
    .trim()
    .toLowerCase();
  return ["1", "true", "yes", "y"].includes(v);
}

export function parseAttendancePct(raw: string): number | null {
  const stripped = String(raw ?? "")
    .trim()
    .replace(/%$/, "");
  if (!stripped) return null;
  const n = parseFloat(stripped);
  if (Number.isNaN(n)) return null;
  // fractional 0–1 → percent
  if (n > 0 && n <= 1) return Number((n * 100).toFixed(2));
  if (n < 0 || n > 100) return null;
  return Number(n.toFixed(2));
}

function parseIntField(raw: string): number | null {
  const stripped = String(raw ?? "").trim();
  if (!stripped) return 0; // empty → default 0
  const n = parseInt(stripped, 10);
  if (Number.isNaN(n)) return null;
  return n;
}

const VALID_SCOPES = new Set<string>([
  "ROLLING_21_DAYS",
  "ROLLING_28_DAYS",
  "TERM_TO_DATE",
  "YEAR_TO_DATE",
]);

function parseCountScope(raw: string): CountScope | null {
  const v = String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  return VALID_SCOPES.has(v) ? (v as CountScope) : null;
}

function parseSnapshotDate(raw: string): Date | null {
  const stripped = String(raw ?? "").trim();
  if (!stripped) return null;
  const d = new Date(stripped);
  if (isNaN(d.getTime())) return null;
  // store as midnight UTC
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
}

// ── main parser ───────────────────────────────────────────────────────────────

export function parseSnapshotCsv(
  csvText: string,
  mapping: SnapshotMapping,
  importDate: Date = new Date()
): ParseResult {
  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

  const rows: SnapshotRow[] = [];
  const errors: RowError[] = [];

  // Duplicate UPN detection
  const seenUpns = new Map<string, number>(); // upn → first rowNumber

  const col = (record: Record<string, string>, anaxiField: AnaxiField) =>
    record[mapping.fieldMap[anaxiField] ?? ""] ?? "";

  // Normalise importDate to midnight UTC
  const fallbackDate = new Date(
    Date.UTC(
      importDate.getUTCFullYear(),
      importDate.getUTCMonth(),
      importDate.getUTCDate()
    )
  );

  records.forEach((record, idx) => {
    const rowNum = idx + 2; // 1-based + header
    const upn = col(record, "UPN").trim();
    const studentName = col(record, "StudentName").trim();
    const yearGroupRaw = col(record, "YearGroup").trim();

    const errs: RowError[] = [];

    const addError = (errorCode: string, message: string) =>
      errs.push({ rowNumber: rowNum, upn, studentName, yearGroup: yearGroupRaw, errorCode, message });

    // UPN
    if (!upn) {
      addError("MISSING_UPN", "UPN is required");
    } else {
      if (seenUpns.has(upn)) {
        addError(
          "DUPLICATE_UPN_IN_FILE",
          `UPN '${upn}' appears more than once in this file (first at row ${seenUpns.get(upn)})`
        );
      } else {
        seenUpns.set(upn, rowNum);
      }
    }

    // YearGroup
    const yearGroupNum = parseInt(yearGroupRaw.replace(/\D/g, ""), 10);
    if (
      yearGroupRaw &&
      (Number.isNaN(yearGroupNum) || yearGroupNum < 7 || yearGroupNum > 13)
    ) {
      addError("INVALID_YEAR_GROUP", `Year group '${yearGroupRaw}' must be 7–13`);
    }

    // AttendancePercent
    const attendanceRaw = col(record, "AttendancePercent");
    const attendanceParsed = parseAttendancePct(attendanceRaw);
    if (attendanceRaw.trim() && attendanceParsed === null) {
      addError(
        "INVALID_ATTENDANCE",
        `Attendance '${attendanceRaw}' is not a valid percentage (0–100)`
      );
    }

    // Numeric fields
    const numericParsed: Record<string, number | null> = {};
    for (const [field, anaxiKey] of [
      ["lates", "Lates"],
      ["detentions", "Detentions"],
      ["internalExclusions", "InternalExclusions"],
      ["suspensions", "Suspensions"],
      ["positivePoints", "PositivePoints"],
      ["negativePoints", "NegativePoints"],
    ] as [string, AnaxiField][]) {
      const raw = col(record, anaxiKey);
      const parsed = parseIntField(raw);
      if (parsed === null) {
        addError(
          "INVALID_NUMERIC",
          `Field '${anaxiKey}' value '${raw}' is not a valid integer`
        );
      }
      numericParsed[field] = parsed;
    }

    // CountScope
    let countScope: CountScope | null = null;
    if (mapping.countScopeColumn) {
      const raw = (record[mapping.countScopeColumn] ?? "").trim();
      countScope = parseCountScope(raw);
      if (!countScope) {
        addError(
          "INVALID_COUNTSCOPE",
          `CountScope '${raw}' is not one of: ROLLING_21_DAYS, ROLLING_28_DAYS, TERM_TO_DATE, YEAR_TO_DATE`
        );
      }
    } else if (mapping.fixedCountScope) {
      countScope = mapping.fixedCountScope;
    } else {
      addError("MISSING_COUNTSCOPE", "CountScope must be supplied via a mapped column or a fixed selection");
    }

    // SnapshotDate
    let snapshotDate: Date = fallbackDate;
    if (mapping.snapshotDateColumn) {
      const raw = (record[mapping.snapshotDateColumn] ?? "").trim();
      if (raw) {
        const parsed = parseSnapshotDate(raw);
        if (!parsed) {
          addError("INVALID_DATE", `SnapshotDate '${raw}' is not a valid date (YYYY-MM-DD)`);
        } else {
          snapshotDate = parsed;
        }
      }
    }

    if (errs.length > 0) {
      errors.push(...errs);
    } else {
      rows.push({
        upn,
        studentName,
        yearGroup: yearGroupRaw,
        attendancePercent: attendanceParsed ?? 0,
        lates: numericParsed.lates ?? 0,
        detentions: numericParsed.detentions ?? 0,
        internalExclusions: numericParsed.internalExclusions ?? 0,
        suspensions: numericParsed.suspensions ?? 0,
        positivePoints: numericParsed.positivePoints ?? 0,
        negativePoints: numericParsed.negativePoints ?? 0,
        send: parseBoolean(col(record, "SEND")),
        pp: parseBoolean(col(record, "PP")),
        countScope: countScope!,
        snapshotDate,
      });
    }
  });

  return { rows, errors };
}
