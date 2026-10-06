import type { GradeFormat, PointType, QualificationType } from "@prisma/client";

export type ArborAssessmentFamily = "GCSE" | "A_LEVEL" | "KS3_PERCENTAGE" | "Y10_PERCENTAGE";

export type ArborAssessmentMapping = {
  family: ArborAssessmentFamily;
  academicYear: string;
  cycleLabel: string;
  cycleExternalId: string;
  cohortLabel: string;
  qualificationType: QualificationType;
  gradeFormat: GradeFormat;
  yearGroups: string[];
  pointLabel: string;
  pointExternalId: string;
  pointOrdinal: number;
  pointType: PointType;
  isFinalPoint: boolean;
};

/** Identifies an agreed assessment family without assuming a term. */
export function arborAssessmentFamily(name: string): ArborAssessmentFamily | null {
  const label = name.trim();
  if (!label || /\b(predicted|prediction|target|baseline|meg)\b/i.test(label)) return null;

  const finalResult = /\b(actual|exam\s*board|final\s*result|results?)\b/i.test(label);
  // P8 also contains Level 3 / AS catalogue entries in this Arbor tenant.
  // The agreed Anaxi source is P8 GCSE outcomes only.
  if ((/\bP8\b/i.test(label) && /\bGCSE\b/i.test(label)) || (finalResult && /\bGCSE\b/i.test(label))) return "GCSE";
  if (/\bA[- ]?Level\b/i.test(label)) return "A_LEVEL";
  if (/%\s*KS\s*3\b|\bKS\s*3\b.*%/i.test(label)) return "KS3_PERCENTAGE";
  if (/%\s*(?:Y\s*10|Year\s*10)\b|\b(?:Y\s*10|Year\s*10)\b.*%/i.test(label)) return "Y10_PERCENTAGE";
  return null;
}

function academicYearFor(date: Date): string {
  const year = date.getUTCFullYear();
  const startsIn = date.getUTCMonth() >= 8 ? year : year - 1;
  return `${startsIn}/${startsIn + 1}`;
}

/** Converts Arbor's current academic level into the student's year at a historic assessment. */
export function arborYearGroupAtAssessment(currentAcademicLevel: string | null | undefined, academicYear: string, now = new Date()): string | null {
  const match = currentAcademicLevel?.trim().match(/^(?:Year|Y)\s*0?(\d{1,2})$/i);
  const assessmentStart = Number(academicYear.slice(0, 4));
  if (!match || !Number.isInteger(assessmentStart)) return null;
  const currentStart = now.getUTCFullYear() - (now.getUTCMonth() < 8 ? 1 : 0);
  const historicYear = Number(match[1]) - (currentStart - assessmentStart);
  return historicYear >= 1 && historicYear <= 13 ? `Y${historicYear}` : null;
}

/**
 * Resolves a pupil's year group at a historic mark. Leavers no longer have a
 * current Arbor academic level, so use the archived Anaxi level at their
 * leaving date as the reference point before applying a narrow final-year
 * fallback for unlinked assessment records.
 */
export function arborHistoricYearGroup(
  currentAcademicLevel: string | null | undefined,
  archivedYearGroup: string | null | undefined,
  leavingDate: string | null | undefined,
  academicYear: string,
  family: ArborAssessmentFamily,
): string | null {
  const leaving = leavingDate ? new Date(leavingDate) : null;
  const archived = leaving && !Number.isNaN(leaving.getTime())
    ? arborYearGroupAtAssessment(archivedYearGroup, academicYear, leaving)
    : null;
  if (archived) return archived;

  // Arbor can omit leavingDate on a historic mark even when the matching
  // pupil has already been archived in Anaxi. For the immediately preceding
  // academic year only, that archived level is still an unambiguous final
  // cohort indicator. Do not extend this shortcut to older years.
  const archivedMatch = archivedYearGroup?.trim().match(/^(?:Year|Y)\s*0?(\d{1,2})$/i);
  const currentAcademicStart = new Date().getUTCFullYear() - (new Date().getUTCMonth() < 8 ? 1 : 0);
  if (archivedMatch && Number(academicYear.slice(0, 4)) === currentAcademicStart - 1) {
    const archivedYear = Number(archivedMatch[1]);
    if (archivedYear >= 1 && archivedYear <= 13) return `Y${archivedYear}`;
  }

  // Arbor may retain a leaver's final level on a historic mark. Only use that
  // field after the archived Anaxi record, otherwise a former Year 13 is
  // incorrectly rewound to Year 12 for the prior academic year.
  const current = arborYearGroupAtAssessment(currentAcademicLevel, academicYear);
  if (current) return current;

  // This fallback is limited to final secondary cohorts and is used only to
  // make an unlinked historic review visible; approval/import remains gated.
  if (family === "GCSE") return "Y11";
  if (family === "A_LEVEL" && leaving && !Number.isNaN(leaving.getTime())) {
    const leavingAcademicStart = leaving.getUTCFullYear() - (leaving.getUTCMonth() < 8 ? 1 : 0);
    return leavingAcademicStart === Number(academicYear.slice(0, 4)) ? "Y13" : null;
  }
  return null;
}

function academicYearFromLabel(label: string): string | null {
  const match = label.match(/\b(20\d{2})\s*[-/]\s*(20\d{2})\b/);
  if (!match) return null;
  const start = Number(match[1]);
  const end = Number(match[2]);
  return end === start + 1 ? `${start}/${end}` : null;
}

function namedPeriod(value?: string | null): { label: string; ordinal: number } | null {
  if (/\bautumn\b/i.test(value ?? "")) return { label: "Autumn", ordinal: 10 };
  if (/\bspring\b/i.test(value ?? "")) return { label: "Spring", ordinal: 20 };
  if (/\bsummer\b/i.test(value ?? "")) return { label: "Summer", ordinal: 30 };
  return null;
}

function periodFor(definitionName: string, periodHint: string | null | undefined, finalResult: boolean, assessmentDate?: string | null): { label: string; ordinal: number } | null {
  if (finalResult) return { label: "Final", ordinal: 90 };

  // A reusable Arbor label can retain an old term (for example "Autumn")
  // while the recorded mark is dated in July. A dated mark therefore always
  // determines its own term; labels are only safe fallbacks when no date was
  // returned by Arbor.
  const date = assessmentDate ? new Date(assessmentDate) : null;
  if (date && !Number.isNaN(date.getTime())) {
    const month = date.getUTCMonth();
    if (month >= 8) return { label: "Autumn", ordinal: 10 };
    if (month >= 0 && month <= 3) return { label: "Spring", ordinal: 20 };
    // July and August include the summer assessment window and published
    // examination outcomes; an explicit final-result label still takes
    // precedence above.
    if (month >= 4 && month <= 7) return { label: "Summer", ordinal: 30 };
  }

  const hintedPeriod = namedPeriod(periodHint);
  if (hintedPeriod) return hintedPeriod;

  return namedPeriod(definitionName);
}

/** Maps only the agreed Goresbrook Secondary assessment families. */
export function mapArborAssessment(name: string, assessmentDate?: string | null, periodHint?: string | null): ArborAssessmentMapping | null {
  const label = name.trim();
  if (!label) return null;

  const finalResult = /\b(actual|exam\s*board|final\s*result|results?)\b/i.test(label);
  const family = arborAssessmentFamily(label);
  if (!family) return null;

  // Final external outcomes are intentionally limited to GCSE and A-Level.
  if (finalResult && family !== "GCSE" && family !== "A_LEVEL") return null;
  // Arbor often keeps the subject definition term-neutral, while the mark
  // itself carries the Autumn/Spring/Summer label. Preserve that distinction.
  const period = periodFor(label, periodHint, finalResult, assessmentDate);
  if (!period) return null;
  const date = assessmentDate ? new Date(assessmentDate) : new Date();
  // Markbooks commonly include the academic year in their name. Prefer that
  // stable source value so historic definitions cannot be named as this year.
  const academicYear = academicYearFromLabel(label) ?? (Number.isNaN(date.getTime()) ? academicYearFor(new Date()) : academicYearFor(date));

  const details = family === "GCSE"
    ? { cycleLabel: `${academicYear} - Year 11 - GCSE - ${period.label}`, cohortLabel: "Year 11", qualificationType: "GCSE" as QualificationType, gradeFormat: "GCSE" as GradeFormat, yearGroups: ["Y11"] }
    : family === "A_LEVEL"
      ? { cycleLabel: `${academicYear} - A-Level - ${period.label}`, cohortLabel: "Years 12–13", qualificationType: "A_LEVEL" as QualificationType, gradeFormat: "A_LEVEL" as GradeFormat, yearGroups: ["Y12", "Y13"] }
      : family === "KS3_PERCENTAGE"
        ? { cycleLabel: `${academicYear} - KS3 - % - ${period.label}`, cohortLabel: "Years 7–9", qualificationType: "PERCENTAGE" as QualificationType, gradeFormat: "PERCENTAGE" as GradeFormat, yearGroups: ["Y7", "Y8", "Y9"] }
        : { cycleLabel: `${academicYear} - Year 10 - % - ${period.label}`, cohortLabel: "Year 10", qualificationType: "PERCENTAGE" as QualificationType, gradeFormat: "PERCENTAGE" as GradeFormat, yearGroups: ["Y10"] };

  return {
    family,
    academicYear,
    ...details,
    cycleExternalId: `ARBOR:assessment-cycle:${academicYear}:${family}:${period.ordinal}`,
    pointLabel: period.label,
    pointExternalId: `ARBOR:assessment-point:${academicYear}:${family}:${period.ordinal}`,
    pointOrdinal: period.ordinal,
    pointType: finalResult ? "EXTERNAL_FINAL" : "INTERNAL_ASSESSMENT",
    isFinalPoint: finalResult,
  };
}

/** Splits shared Arbor families into the requested per-year-group Anaxi cycles. */
export function mapArborAssessmentForYearGroup(mapping: ArborAssessmentMapping, yearGroup: string | null): ArborAssessmentMapping | null {
  if (!yearGroup || !mapping.yearGroups.includes(yearGroup)) return null;
  const year = yearGroup.replace(/^Y/i, "Year ");
  const phase = mapping.family === "GCSE" ? "GCSE" : mapping.family === "A_LEVEL" ? "A-Level" : "%";
  return {
    ...mapping,
    cycleLabel: `${mapping.academicYear} - ${year} - ${phase} - ${mapping.pointLabel}`,
    cycleExternalId: `${mapping.cycleExternalId}:${yearGroup}`,
    cohortLabel: year,
    pointExternalId: `${mapping.pointExternalId}:${yearGroup}`,
  };
}

export function arborAssessmentLabel(assessment: { displayName: string | null; assessmentName: string | null; assessmentShortName: string | null }): string {
  return assessment.assessmentName || assessment.assessmentShortName || assessment.displayName || "Untitled assessment";
}
