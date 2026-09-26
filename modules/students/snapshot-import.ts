import { parse } from "csv-parse/sync";
import type { MappableField } from "./snapshot-fields";

export interface SnapshotMapping {
  /** Maps each Anaxi field (required, plus optional KS2 scores) to the CSV column header */
  fieldMap: Partial<Record<MappableField, string>>;
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
  send: boolean;
  pp: boolean;
  /** null = column unmapped or cell blank; the stored score is left untouched */
  ks2ReadingScaledScore: number | null;
  ks2MathsScaledScore: number | null;
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

/** KS2 scaled scores run 80–120. Blank → null (leave stored value); invalid → NaN. */
export function parseScaledScore(raw: string): number | null {
  const stripped = String(raw ?? "").trim();
  if (!stripped) return null;
  const n = Number(stripped);
  if (!Number.isInteger(n) || n < 80 || n > 120) return Number.NaN;
  return n;
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

  const col = (record: Record<string, string>, anaxiField: MappableField) =>
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
    ] as [string, MappableField][]) {
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

    // KS2 scaled scores (optional)
    const scaledScores: Record<string, number | null> = {};
    for (const [field, anaxiKey] of [
      ["ks2ReadingScaledScore", "KS2ReadingScaledScore"],
      ["ks2MathsScaledScore", "KS2MathsScaledScore"],
    ] as [string, MappableField][]) {
      const raw = col(record, anaxiKey);
      const parsed = parseScaledScore(raw);
      if (Number.isNaN(parsed)) {
        addError(
          "INVALID_SCALED_SCORE",
          `Field '${anaxiKey}' value '${raw}' must be a whole number between 80 and 120`
        );
      }
      scaledScores[field] = parsed;
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
        send: parseBoolean(col(record, "SEND")),
        pp: parseBoolean(col(record, "PP")),
        ks2ReadingScaledScore: scaledScores.ks2ReadingScaledScore,
        ks2MathsScaledScore: scaledScores.ks2MathsScaledScore,
        snapshotDate,
      });
    }
  });

  return { rows, errors };
}
