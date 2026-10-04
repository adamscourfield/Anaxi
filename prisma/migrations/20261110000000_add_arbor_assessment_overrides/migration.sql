ALTER TABLE "AssessmentResult"
  ADD COLUMN IF NOT EXISTS "arborRawValue" TEXT,
  ADD COLUMN IF NOT EXISTS "arborNormalizedScore" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "arborNormalisedGrade" TEXT,
  ADD COLUMN IF NOT EXISTS "arborSyncedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "isManuallyOverridden" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "manualOverrideAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "manualOverrideByUserId" TEXT;

UPDATE "AssessmentResult"
SET
  "arborRawValue" = "rawValue",
  "arborNormalizedScore" = "normalizedScore",
  "arborNormalisedGrade" = "normalisedGrade",
  "arborSyncedAt" = "updatedAt"
WHERE "dataSource" = 'ARBOR'
  AND "arborRawValue" IS NULL;
