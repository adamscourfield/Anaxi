/**
 * Key stages a Subject can be tagged with. A subject with no stages applies
 * everywhere; tagging it narrows which cycles/points its name is suggested for.
 */
export const SUBJECT_STAGES = ["KS3", "GCSE", "A_LEVEL"] as const;
export type SubjectStage = (typeof SUBJECT_STAGES)[number];

export const SUBJECT_STAGE_LABELS: Record<SubjectStage, string> = {
  KS3: "Key Stage 3",
  GCSE: "GCSE",
  A_LEVEL: "A-Level",
};

export function isSubjectStage(value: string): value is SubjectStage {
  return (SUBJECT_STAGES as readonly string[]).includes(value);
}

/**
 * Map an assessment cycle's qualification type to the subject stage it
 * corresponds to. PERCENTAGE/OTHER cycles don't map cleanly onto a single
 * key stage, so callers should treat a null return as "don't filter."
 */
export function stageForQualificationType(qualificationType: string): SubjectStage | null {
  if (qualificationType === "GCSE") return "GCSE";
  if (qualificationType === "A_LEVEL") return "A_LEVEL";
  return null;
}
