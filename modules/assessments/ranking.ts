/**
 * Assessment Ranking Module
 *
 * Parses a multi-subject assessment CSV (wide format with Score/Rank column
 * pairs) and recomputes all subject-level ranks and the overall average rank.
 *
 * Expected CSV layout:
 *   Name | Year Group | Teaching Group | SEN | PP |
 *   [Subject] Score | [Subject] Rank | ... |
 *   Overall Average | Overall Rank
 *
 * Pre-existing rank values are ignored and fully recomputed. Absent / blank
 * scores are excluded from ranking and are not counted in the overall average.
 *
 * Ranking uses standard competition ranking (1224): tied students share the
 * same rank and the next rank skips by the number of ties.
 */

import { parse } from "csv-parse/sync";

// ─── Types ────────────────────────────────────────────────────────────────────

export type StudentRanking = {
  name: string;
  yearGroup: string;
  teachingGroup: string;
  sen: boolean;
  pp: boolean;
  /** Parsed score per subject (0–100), null = absent or no data */
  scores: Record<string, number | null>;
  /** Computed rank per subject, null = not ranked (absent/no data) */
  subjectRanks: Record<string, number | null>;
  /** Mean of all non-null scores (0–100), null if no scores at all */
  overallAverage: number | null;
  /** Rank by overall average, null if no overall average */
  overallRank: number | null;
};

export type RankingResult = {
  subjects: string[];
  students: StudentRanking[];
  /** Row-level warnings (non-fatal data quality issues) */
  warnings: Array<{ row: number; field: string; message: string }>;
};

// ─── Score parsing ────────────────────────────────────────────────────────────

const ABSENT_MARKERS = new Set(["absent", "abs", "n/a", "na", "-", ""]);

/**
 * Parse a score cell value into a number (0–100) or null.
 * Returns null for absent markers, blank cells, or unparseable values.
 */
export function parseScore(raw: string): number | null {
  const trimmed = raw.trim().toLowerCase();
  if (ABSENT_MARKERS.has(trimmed)) return null;
  // Strip % suffix
  const numeric = parseFloat(trimmed.replace(/%$/, ""));
  if (isNaN(numeric)) return null;
  return Math.max(0, Math.min(100, numeric));
}

// ─── Competition ranking ──────────────────────────────────────────────────────

/**
 * Assign standard competition ranks (1224 style) to an array of nullable scores.
 * Higher score = lower rank number (rank 1 is best).
 * Null scores receive a null rank.
 *
 * Returns an array of ranks in the same order as the input scores.
 */
export function competitionRank(scores: (number | null)[]): (number | null)[] {
  const indexed = scores.map((score, i) => ({ score, i }));

  // Separate ranked from unranked
  const ranked = indexed.filter((s) => s.score !== null) as Array<{
    score: number;
    i: number;
  }>;

  // Sort descending by score
  ranked.sort((a, b) => b.score - a.score);

  const ranks = new Array<number | null>(scores.length).fill(null);
  let rank = 1;
  for (let pos = 0; pos < ranked.length; ) {
    const currentScore = ranked[pos].score;
    // Find all students tied at this score
    let tieEnd = pos;
    while (tieEnd < ranked.length && ranked[tieEnd].score === currentScore) {
      tieEnd++;
    }
    // Assign the same rank to all tied students
    for (let t = pos; t < tieEnd; t++) {
      ranks[ranked[t].i] = rank;
    }
    rank += tieEnd - pos; // Skip ranks for ties
    pos = tieEnd;
  }

  return ranks;
}

// ─── CSV parser ───────────────────────────────────────────────────────────────

/** Detect subject names from headers by scanning for "[Subject] Score" columns. */
function detectSubjects(headers: string[]): string[] {
  const subjects: string[] = [];
  for (const h of headers) {
    const match = h.trim().match(/^(.+)\s+Score$/i);
    if (match) {
      subjects.push(match[1].trim());
    }
  }
  return subjects;
}

/**
 * Parse a multi-subject assessment CSV and compute all rankings.
 *
 * The input CSV must follow the layout described at the top of this file.
 * Existing rank columns in the CSV are ignored — all ranks are recomputed.
 */
export function parseAndRankAssessmentCsv(csvContent: string): RankingResult {
  const warnings: RankingResult["warnings"] = [];

  const rows = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  }) as Record<string, string>[];

  // Filter out entirely blank rows (can appear at end of spreadsheet exports)
  const dataRows = rows.filter((row) =>
    Object.values(row).some((v) => v.trim() !== "")
  );

  if (dataRows.length === 0) {
    return { subjects: [], students: [], warnings };
  }

  const headers = Object.keys(dataRows[0]);
  const subjects = detectSubjects(headers);

  const students: StudentRanking[] = dataRows.map((row, idx) => {
    const rowNum = idx + 2; // 1-indexed, skip header

    const name = (row["Name"] || "").trim();
    if (!name) {
      warnings.push({ row: rowNum, field: "Name", message: "Missing student name" });
    }

    const senRaw = (row["SEN"] || "").trim().toLowerCase();
    const ppRaw = (row["PP"] || "").trim().toLowerCase();

    const scores: Record<string, number | null> = {};
    for (const subject of subjects) {
      const scoreCol = `${subject} Score`;
      const raw = (row[scoreCol] || "").trim();
      const parsed = parseScore(raw);

      // Warn on unexpected non-numeric, non-absent values
      if (raw && parsed === null && !ABSENT_MARKERS.has(raw.toLowerCase())) {
        warnings.push({
          row: rowNum,
          field: scoreCol,
          message: `Unrecognised score value "${raw}" — treated as absent`,
        });
      }

      scores[subject] = parsed;
    }

    // Overall average: mean of non-null scores
    const validScores = Object.values(scores).filter(
      (s): s is number => s !== null
    );
    const overallAverage =
      validScores.length > 0
        ? validScores.reduce((sum, s) => sum + s, 0) / validScores.length
        : null;

    return {
      name,
      yearGroup: (row["Year Group"] || "").trim(),
      teachingGroup: (row["Teaching Group"] || "").trim(),
      sen: senRaw === "yes" || senRaw === "true" || senRaw === "1",
      pp: ppRaw === "yes" || ppRaw === "true" || ppRaw === "1",
      scores,
      subjectRanks: {}, // filled below
      overallAverage,
      overallRank: null, // filled below
    };
  });

  // Compute per-subject ranks
  for (const subject of subjects) {
    const subjectScores = students.map((s) => s.scores[subject]);
    const ranks = competitionRank(subjectScores);
    students.forEach((student, i) => {
      student.subjectRanks[subject] = ranks[i];
    });
  }

  // Compute overall ranks
  const overallScores = students.map((s) => s.overallAverage);
  const overallRanks = competitionRank(overallScores);
  students.forEach((student, i) => {
    student.overallRank = overallRanks[i];
  });

  return { subjects, students, warnings };
}
