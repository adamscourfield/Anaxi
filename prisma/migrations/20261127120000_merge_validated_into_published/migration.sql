-- Validated and Published behaved identically (both feed attainment insights), so they are one status now:
-- Draft -> Published -> Locked. Existing Validated result points become Published; nothing they show changes.
UPDATE "AssessmentPoint" SET "resultStatus" = 'PUBLISHED' WHERE "resultStatus" = 'VALIDATED';

ALTER TYPE "ResultStatus" RENAME TO "ResultStatus_old";
CREATE TYPE "ResultStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'LOCKED');
ALTER TABLE "AssessmentPoint" ALTER COLUMN "resultStatus" DROP DEFAULT;
ALTER TABLE "AssessmentPoint" ALTER COLUMN "resultStatus" TYPE "ResultStatus" USING ("resultStatus"::text::"ResultStatus");
ALTER TABLE "AssessmentPoint" ALTER COLUMN "resultStatus" SET DEFAULT 'DRAFT';
DROP TYPE "ResultStatus_old";
