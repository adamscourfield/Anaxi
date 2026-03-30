/**
 * Assessment CSV Parser
 *
 * Parses assessment result CSV files into typed records.
 *
 * Two supported CSV layouts:
 *
 * 1. Wide format (one row per student, one grade column per subject):
 *    Name | Maths | English Language | Science | ...
 *    Also supports: UPN | Name | Maths | English | ...
 *
 * 2. Long format (one row per result):
 *    UPN | Name | Subject | Grade
 *
 * The parser auto-detects the layout. Non-grade columns (PP, SEND, Gender,
 * Attendance, etc.) are automatically excluded. Computed aggregate columns
 * like "English Best" and "Avg. Science" are also excluded by default.
 *
 * Student matching: prefers UPN if present, falls back to name-based matching.
 * A-Level name format "Lastname, Firstname" is normalised automatically.
 */

import { parse } from "csv-parse/sync";
import { validateGrade, detectNonGradeStatus } from "./gradeNormalizer";
import type { GradeFormat } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AssessmentCsvRecord = {
  upn: string;
  studentName: string;
  subject: string;
  rawValue: string;
};

export type AssessmentCsvError = {
  rowNumber: number;
  field: string;
  message: string;
};

export type AssessmentCsvResult = {
  records: AssessmentCsvRecord[];
  errors: AssessmentCsvError[];
  preview: AssessmentCsvRecord[];
  /** Detected layout: 'wide' or 'long' */
  layout: "wide" | "long";
  /** Subject columns found in wide-format CSVs */
  detectedSubjects?: string[];
};

// ─── Non-grade meta columns to exclude in wide format ─────────────────────────

/**
 * These column names (case-insensitive) are never treated as subject grade
 * columns in wide-format CSVs.
 */
const META_COLUMN_PATTERNS = [
  /^upn$/i,
  /^name$/i,
  /^other[\s_-]?name$/i,
  /^pp$/i,
  /^pupil[\s_-]?premium$/i,
  /^send$/i,
  /^gender$/i,
  /^sex$/i,
  /^form$/i,
  /^tutor[\s_-]?group$/i,
  /^class$/i,
  /^attendance$/i,
  /^lateness$/i,
  /^rerout(ing)?s?$/i,
  /^navigation$/i,
  /^dtas?$/i,
  /^exclusions?$/i,
  /^detentions?$/i,
  /^year[\s_-]?group$/i,
  /^dob$/i,
  /^date[\s_-]?of[\s_-]?birth$/i,
  // Aggregate / computed columns — strip these from subject list
  /^(avg|average)[\s._-]/i,
  /[\s._-](avg|average)$/i,
  /\bavg\b/i,
  /\bbest\b/i,
  /^total$/i,
  /^overall$/i,
];

function isMetaColumn(header: string): boolean {
  return META_COLUMN_PATTERNS.some((re) => re.test(header.trim()));
}

// ─── Name normalisation ───────────────────────────────────────────────────────

/**
 * Normalise a student name from CSV.
 * Handles:
 *   - "Lastname, Firstname"  → "Firstname Lastname"  (A-Level format)
 *   - "Firstname Lastname"   → unchanged
 */
export function normaliseStudentName(raw: string): string {
  const trimmed = raw.trim();
  // "Lastname, Firstname [Middle]" format
  if (trimmed.includes(",")) {
    const parts = trimmed.split(",").map((p) => p.trim());
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return `${parts[1]} ${parts[0]}`;
    }
  }
  return trimmed;
}

// ─── Layout detection ─────────────────────────────────────────────────────────

/**
 * Detect whether the CSV is wide (grade per column) or long (one row per result).
 * Long format is identified by a "Subject" column.
 */
function detectLayout(headers: string[]): "wide" | "long" {
  const lower = headers.map((h) => h.toLowerCase().trim());
  if (lower.includes("subject")) return "long";
  return "wide";
}

// ─── Canonical field resolution ───────────────────────────────────────────────

function resolveField(
  row: Record<string, string>,
  mapping: Record<string, string>,
  canonical: string
): string {
  const mapped = mapping[canonical];
  if (mapped && row[mapped] !== undefined) return row[mapped];
  if (row[canonical] !== undefined) return row[canonical];
  return "";
}

// ─── Find name column in row headers ─────────────────────────────────────────

function findNameColumn(headers: string[]): string | null {
  const candidates = ["Name", "Student Name", "Student", "Full Name", "Pupil Name"];
  for (const c of candidates) {
    if (headers.some((h) => h.trim().toLowerCase() === c.toLowerCase())) {
      return headers.find((h) => h.trim().toLowerCase() === c.toLowerCase())!;
    }
  }
  return null;
}

function findUpnColumn(headers: string[]): string | null {
  const candidates = ["UPN", "Upn", "upn", "Pupil UPN", "Student UPN"];
  for (const c of candidates) {
    if (headers.some((h) => h.trim().toLowerCase() === c.toLowerCase())) {
      return headers.find((h) => h.trim().toLowerCase() === c.toLowerCase())!;
    }
  }
  return null;
}

// ─── Wide format parser ───────────────────────────────────────────────────────

/**
 * Wide format: [UPN] | Name | [Subject1] | [Subject2] | ...
 * Meta columns (PP, SEND, Gender, Attendance, etc.) are automatically excluded.
 * Subjects can be filtered to a specific subset via subjectFilter.
 */
function parseWide(
  rows: Record<string, string>[],
  headers: string[],
  mapping: Record<string, string>,
  gradeFormat: GradeFormat,
  maxScore?: number | null,
  subjectFilter?: string[]
): AssessmentCsvResult {
  const records: AssessmentCsvRecord[] = [];
  const errors: AssessmentCsvError[] = [];

  const upnCol = mapping["UPN"] || findUpnColumn(headers);
  const nameCol = mapping["Name"] || findNameColumn(headers) || "Name";

  // Subject columns = everything that isn't a meta column
  const subjectCols = headers.filter((h) => !isMetaColumn(h));
  const detectedSubjects = subjectCols.filter((h) => {
    if (!subjectFilter) return true;
    return subjectFilter.includes(h);
  });

  rows.forEach((row, idx) => {
    const rowNum = idx + 2;
    const upn = upnCol ? (row[upnCol] || "").trim() : "";
    const rawName = (row[nameCol] || "").trim();
    const studentName = normaliseStudentName(rawName);

    if (!studentName) {
      errors.push({ rowNumber: rowNum, field: "Name", message: "Student name is required" });
      return;
    }

    const activeCols = subjectFilter
      ? subjectCols.filter((c) => subjectFilter.includes(c))
      : subjectCols;

    for (const col of activeCols) {
      const rawValue = (row[col] || "").trim();
      if (!rawValue) continue; // blank cell = skip (student didn't sit this subject)

      const nonGrade = detectNonGradeStatus(rawValue);
      if (!nonGrade) {
        const validationError = validateGrade(rawValue, gradeFormat, maxScore);
        if (validationError) {
          errors.push({ rowNumber: rowNum, field: col, message: validationError });
          continue;
        }
      }

      records.push({ upn, studentName, subject: col, rawValue });
    }
  });

  return {
    records,
    errors,
    preview: records.slice(0, 20),
    layout: "wide",
    detectedSubjects: subjectCols,
  };
}

// ─── Long format parser ───────────────────────────────────────────────────────

function parseLong(
  rows: Record<string, string>[],
  mapping: Record<string, string>,
  gradeFormat: GradeFormat,
  maxScore?: number | null,
  subjectFilter?: string[]
): AssessmentCsvResult {
  const records: AssessmentCsvRecord[] = [];
  const errors: AssessmentCsvError[] = [];

  rows.forEach((row, idx) => {
    const rowNum = idx + 2;
    const upn = resolveField(row, mapping, "UPN").trim();
    const rawName = resolveField(row, mapping, "Name").trim();
    const studentName = normaliseStudentName(rawName);
    const subject = resolveField(row, mapping, "Subject").trim();
    const rawValue = resolveField(row, mapping, "Grade").trim();

    if (!studentName) {
      errors.push({ rowNumber: rowNum, field: "Name", message: "Student name is required" });
      return;
    }
    if (!subject) {
      errors.push({ rowNumber: rowNum, field: "Subject", message: "Subject is required" });
      return;
    }
    if (!rawValue) return; // blank = skip

    if (subjectFilter && !subjectFilter.includes(subject)) return;

    const nonGrade = detectNonGradeStatus(rawValue);
    if (!nonGrade) {
      const validationError = validateGrade(rawValue, gradeFormat, maxScore);
      if (validationError) {
        errors.push({ rowNumber: rowNum, field: "Grade", message: validationError });
        return;
      }
    }

    records.push({ upn, studentName, subject, rawValue });
  });

  return { records, errors, preview: records.slice(0, 20), layout: "long" };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export type ParseAssessmentCsvOptions = {
  /** Column mapping: canonical name → actual CSV header */
  mapping?: Record<string, string>;
  gradeFormat: GradeFormat;
  maxScore?: number | null;
  /** If set, only parse columns/rows for these subjects */
  subjectFilter?: string[];
};

export function parseAssessmentCsv(
  csvContent: string,
  options: ParseAssessmentCsvOptions
): AssessmentCsvResult {
  const { mapping = {}, gradeFormat, maxScore, subjectFilter } = options;

  const rows = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

  if (rows.length === 0) {
    return { records: [], errors: [], preview: [], layout: "long" };
  }

  const headers = Object.keys(rows[0]);
  const layout = detectLayout(headers);

  if (layout === "wide") {
    return parseWide(rows, headers, mapping, gradeFormat, maxScore, subjectFilter);
  } else {
    return parseLong(rows, mapping, gradeFormat, maxScore, subjectFilter);
  }
}

// ─── Header inspection ────────────────────────────────────────────────────────

/**
 * Return the list of subject columns that would be extracted from a wide-format CSV.
 * Used by the upload UI to let users confirm / filter subjects.
 */
export function detectSubjectColumns(csvContent: string): string[] {
  const rows = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    to: 1,
    trim: true,
  }) as Record<string, string>[];

  if (rows.length === 0) return [];
  const headers = Object.keys(rows[0]);
  if (detectLayout(headers) !== "wide") return [];
  return headers.filter((h) => !isMetaColumn(h));
}

// ─── Header signature ─────────────────────────────────────────────────────────

/** Produce a stable signature from CSV headers for mapping auto-detection. */
export function computeHeaderSignature(csvContent: string): string {
  const rows = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    to: 1,
    trim: true,
  }) as Record<string, string>[];

  if (rows.length === 0) return "";
  return Object.keys(rows[0]).sort().join(",");
}

// ─── Template helpers ─────────────────────────────────────────────────────────

export const ASSESSMENT_CSV_TEMPLATES = {
  wide: {
    description: "Wide format — one row per student, one column per subject (most common)",
    headers: ["Name", "Maths", "English Language", "Science"],
    example: [
      ["Jane Smith", "7", "6", "8"],
      ["John Doe", "4", "5", "ABS"],
    ],
  },
  wideWithUpn: {
    description: "Wide format with UPN — one row per student, grade per subject column",
    headers: ["UPN", "Name", "Maths", "English", "Science"],
    example: [
      ["ABC123", "Jane Smith", "7", "6", "8"],
      ["DEF456", "John Doe", "4", "5", "ABS"],
    ],
  },
  aLevel: {
    description: "A-Level wide format — name as 'Lastname, Firstname'",
    headers: ["Name", "Maths", "Biology", "History"],
    example: [
      ['"Smith, Jane"', "A", "B", ""],
      ['"Doe, John"', "", "A*", "C"],
    ],
  },
  long: {
    description: "Long format — one row per student per subject",
    headers: ["UPN", "Name", "Subject", "Grade"],
    example: [
      ["ABC123", "Jane Smith", "Maths", "7"],
      ["ABC123", "Jane Smith", "English", "6"],
      ["DEF456", "John Doe", "Maths", "4"],
    ],
  },
} as const;
