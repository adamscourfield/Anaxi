-- AlterEnum: replace VOCATIONAL with PERCENTAGE in QualificationType
-- Step 1: add new value
ALTER TYPE "QualificationType" ADD VALUE 'PERCENTAGE';

-- Step 2: migrate any existing VOCATIONAL cycles to OTHER
UPDATE "AssessmentCycle" SET "qualificationType" = 'OTHER' WHERE "qualificationType" = 'VOCATIONAL';

-- Step 3: remove VOCATIONAL (requires recreating the enum in Postgres)
-- Rename old enum
ALTER TYPE "QualificationType" RENAME TO "QualificationType_old";
-- Create new enum without VOCATIONAL
CREATE TYPE "QualificationType" AS ENUM ('GCSE', 'A_LEVEL', 'PERCENTAGE', 'OTHER');
-- Migrate column
ALTER TABLE "AssessmentCycle" ALTER COLUMN "qualificationType" TYPE "QualificationType" USING "qualificationType"::text::"QualificationType";
-- Drop old enum
DROP TYPE "QualificationType_old";

-- AlterTable: add rank column to AssessmentResult
ALTER TABLE "AssessmentResult" ADD COLUMN "rank" INTEGER;
