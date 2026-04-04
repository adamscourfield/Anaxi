/**
 * Grade Normalizer — Assessment Module
 *
 * Converts raw grade values from four supported formats into a normalized
 * 0.0–1.0 float (normalizedScore) for cross-format metric computation.
 *
 * Formats:
 *   GCSE        — integer 1–9 (U/0 accepted as 0)
 *   A_LEVEL     — A*, A, B, C, D, E, U
 *   PERCENTAGE  — float 0–100
 *   RAW         — integer 0–maxScore (maxScore required)
 */

import type { GradeFormat } from "@prisma/client";

// ─── A-Level grade ordering ───────────────────────────────────────────────────

const A_LEVEL_SCORES: Record<string, number> = {
  "A*": 1.0,
  A: 6 / 7,
  B: 5 / 7,
  C: 4 / 7,
  D: 3 / 7,
  E: 2 / 7,
  U: 0,
};

// ─── Normalise a single raw value ─────────────────────────────────────────────

export function normalizeGrade(
  rawValue: string,
  format: GradeFormat,
  maxScore?: number | null
): number | null {
  const trimmed = rawValue.trim().toUpperCase();

  switch (format) {
    case "GCSE": {
      const n = parseFloat(trimmed);
      if (isNaN(n)) return null;
      const clamped = Math.max(0, Math.min(9, n));
      return clamped / 9;
    }

    case "A_LEVEL": {
      const score = A_LEVEL_SCORES[trimmed];
      return score !== undefined ? score : null;
    }

    case "PERCENTAGE": {
      const n = parseFloat(trimmed.replace(/%$/, ""));
      if (isNaN(n)) return null;
      return Math.max(0, Math.min(100, n)) / 100;
    }

    case "RAW": {
      if (!maxScore || maxScore <= 0) return null;
      const n = parseFloat(trimmed);
      if (isNaN(n)) return null;
      return Math.max(0, Math.min(maxScore, n)) / maxScore;
    }

    default:
      return null;
  }
}

// ─── Threshold normalisation ──────────────────────────────────────────────────

/**
 * Convert a human-readable threshold string to a normalised 0–1 value
 * for comparison against normalizedScore.
 *
 * Examples:
 *   GCSE:       "4"   → 4/9 ≈ 0.444
 *   A_LEVEL:    "C"   → 4/7 ≈ 0.571
 *   PERCENTAGE: "70"  → 0.70
 *   RAW:        "50"  → 50/maxScore
 */
export function normalizeThreshold(
  threshold: string,
  format: GradeFormat,
  maxScore?: number | null
): number | null {
  return normalizeGrade(threshold, format, maxScore);
}

// ─── Grade display helpers ────────────────────────────────────────────────────

/** Return a human-readable representation from a normalised score. */
export function displayGrade(
  normalizedScore: number,
  format: GradeFormat,
  maxScore?: number | null
): string {
  switch (format) {
    case "GCSE": {
      const grade = Math.round(normalizedScore * 9);
      return String(Math.max(1, Math.min(9, grade)));
    }

    case "A_LEVEL": {
      const entries = Object.entries(A_LEVEL_SCORES).sort((a, b) => b[1] - a[1]);
      for (const [label, score] of entries) {
        if (normalizedScore >= score - 0.001) return label;
      }
      return "U";
    }

    case "PERCENTAGE":
      return `${Math.round(normalizedScore * 100)}%`;

    case "RAW":
      if (!maxScore) return String(Math.round(normalizedScore * 100));
      return String(Math.round(normalizedScore * maxScore));

    default:
      return String(normalizedScore);
  }
}

// ─── Grade format validation ──────────────────────────────────────────────────

/** Returns an error message if the raw value is invalid for the format, or null. */
export function validateGrade(
  rawValue: string,
  format: GradeFormat,
  maxScore?: number | null
): string | null {
  const trimmed = rawValue.trim().toUpperCase();

  switch (format) {
    case "GCSE": {
      const n = parseFloat(trimmed);
      if (isNaN(n) || n < 0 || n > 9) {
        return `Invalid GCSE grade "${rawValue}". Expected 0–9.`;
      }
      return null;
    }

    case "A_LEVEL": {
      if (!(trimmed in A_LEVEL_SCORES)) {
        return `Invalid A-Level grade "${rawValue}". Expected A*, A, B, C, D, E, or U.`;
      }
      return null;
    }

    case "PERCENTAGE": {
      const n = parseFloat(trimmed.replace(/%$/, ""));
      if (isNaN(n) || n < 0 || n > 100) {
        return `Invalid percentage "${rawValue}". Expected 0–100.`;
      }
      return null;
    }

    case "RAW": {
      if (!maxScore || maxScore <= 0) {
        return `Max score must be set for RAW format assessments.`;
      }
      const n = parseFloat(trimmed);
      if (isNaN(n) || n < 0 || n > maxScore) {
        return `Invalid raw score "${rawValue}". Expected 0–${maxScore}.`;
      }
      return null;
    }

    default:
      return `Unknown grade format "${format}".`;
  }
}

// ─── Status detection ─────────────────────────────────────────────────────────

const ABSENT_KEYWORDS = new Set(["ABS", "ABSENT", "N/A", "NA", "-"]);
const WITHDRAWN_KEYWORDS = new Set(["W", "WD", "WITHDRAWN", "X"]);

/**
 * Check if a raw value represents an absent or withdrawn student rather than
 * an actual grade. Returns the status string or null if it's a real grade.
 */
export function detectNonGradeStatus(
  rawValue: string
): "ABSENT" | "WITHDRAWN" | null {
  const upper = rawValue.trim().toUpperCase();
  if (ABSENT_KEYWORDS.has(upper)) return "ABSENT";
  if (WITHDRAWN_KEYWORDS.has(upper)) return "WITHDRAWN";
  return null;
}

/**
 * True when the row represents an actual entered grade (not absent/withdrawn
 * placeholder text and successfully normalised for the assessment format).
 */
export function hasRecordedGrade(
  rawValue: string,
  format: GradeFormat,
  maxScore?: number | null
): boolean {
  if (detectNonGradeStatus(rawValue)) return false;
  return normalizeGrade(rawValue, format, maxScore) !== null;
}
