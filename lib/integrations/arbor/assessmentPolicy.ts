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

function academicYearFromLabel(label: string): string | null {
  const match = label.match(/\b(20\d{2})\s*[-/]\s*(20\d{2})\b/);
  if (!match) return null;
  const start = Number(match[1]);
  const end = Number(match[2]);
  return end === start + 1 ? `${start}/${end}` : null;
}

function periodFor(name: string, finalResult: boolean, assessmentDate?: string | null): { label: string; ordinal: number } | null {
  if (finalResult) return { label: "Final", ordinal: 90 };
  if (/\bautumn\b/i.test(name)) return { label: "Autumn", ordinal: 10 };
  if (/\bspring\b/i.test(name)) return { label: "Spring", ordinal: 20 };
  if (/\bsummer\b/i.test(name)) return { label: "Summer", ordinal: 30 };
  // Catalogue definitions can omit the period; use the dated mark when available.
  const date = assessmentDate ? new Date(assessmentDate) : new Date();
  if (Number.isNaN(date.getTime())) return null;
  const month = date.getUTCMonth();
  if (month >= 8 || month <= 11) return { label: "Autumn", ordinal: 10 };
  if (month >= 0 && month <= 3) return { label: "Spring", ordinal: 20 };
  if (month >= 4 && month <= 6) return { label: "Summer", ordinal: 30 };
  return null;
}

/** Maps only the agreed Goresbrook Secondary assessment families. */
export function mapArborAssessment(name: string, assessmentDate?: string | null, periodHint?: string | null): ArborAssessmentMapping | null {
  const label = name.trim();
  if (!label || /\b(predicted|prediction|target|baseline|meg)\b/i.test(label)) return null;

  const finalResult = /\b(actual|exam\s*board|final\s*result|results?)\b/i.test(label);
  let family: ArborAssessmentFamily | null = null;
  // Routine GCSE assessments are deliberately excluded: the agreed source is
  // P8, with GCSE included only when it is explicitly an external final result.
  if (/\bP8\b/i.test(label) || (finalResult && /\bGCSE\b/i.test(label))) family = "GCSE";
  else if (/\bA[- ]?Level\b/i.test(label)) family = "A_LEVEL";
  else if (/%\s*KS\s*3\b|\bKS\s*3\b.*%/i.test(label)) family = "KS3_PERCENTAGE";
  else if (/%\s*(?:Y\s*10|Year\s*10)\b|\b(?:Y\s*10|Year\s*10)\b.*%/i.test(label)) family = "Y10_PERCENTAGE";
  if (!family) return null;

  // Final external outcomes are intentionally limited to GCSE and A-Level.
  if (finalResult && family !== "GCSE" && family !== "A_LEVEL") return null;
  // Arbor often keeps the subject definition term-neutral, while the mark
  // itself carries the Autumn/Spring/Summer label. Preserve that distinction.
  const period = periodFor(`${label} ${periodHint ?? ""}`, finalResult, assessmentDate);
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
