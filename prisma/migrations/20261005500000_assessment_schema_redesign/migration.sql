-- Assessment schema redesign: add enums, extend tables with fields added
-- in the Attainment Cycles rewrite that were never captured in a migration.

-- ─── New enums ────────────────────────────────────────────────────────────────

CREATE TYPE "QualificationType" AS ENUM ('GCSE', 'A_LEVEL', 'VOCATIONAL', 'OTHER');

CREATE TYPE "PointType" AS ENUM (
  'BASELINE',
  'INTERNAL_ASSESSMENT',
  'INTERNAL_MOCK',
  'TEACHER_PREDICTION',
  'EXTERNAL_FINAL',
  'OTHER'
);

CREATE TYPE "ResultStatus" AS ENUM ('DRAFT', 'VALIDATED', 'PUBLISHED', 'LOCKED');

CREATE TYPE "UploadStatus" AS ENUM ('UPLOADED', 'VALIDATED', 'PARTIAL', 'ERROR');

-- ─── Extend AssessmentResultStatus ───────────────────────────────────────────

ALTER TYPE "AssessmentResultStatus" ADD VALUE 'MISSING';
ALTER TYPE "AssessmentResultStatus" ADD VALUE 'NOT_ENTERED';

-- ─── AssessmentCycle: new columns ────────────────────────────────────────────

ALTER TABLE "AssessmentCycle"
  ADD COLUMN "cohortLabel"       TEXT              NOT NULL DEFAULT '',
  ADD COLUMN "qualificationType" "QualificationType" NOT NULL DEFAULT 'OTHER',
  ADD COLUMN "academicYear"      TEXT              NOT NULL DEFAULT '',
  ADD COLUMN "status"            TEXT              NOT NULL DEFAULT 'active';

-- ─── AssessmentPoint: new columns ────────────────────────────────────────────

ALTER TABLE "AssessmentPoint"
  ADD COLUMN "shortLabel"        TEXT,
  ADD COLUMN "pointType"         "PointType"   NOT NULL DEFAULT 'INTERNAL_ASSESSMENT',
  ADD COLUMN "resultStatus"      "ResultStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "sourceType"        TEXT          NOT NULL DEFAULT 'csv_upload',
  ADD COLUMN "isFinalPoint"      BOOLEAN       NOT NULL DEFAULT false,
  ADD COLUMN "comparisonEligible" BOOLEAN      NOT NULL DEFAULT true,
  ADD COLUMN "dateTaken"         TIMESTAMP(3),
  ADD COLUMN "updatedAt"         TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- ─── Assessment: new columns ─────────────────────────────────────────────────

ALTER TABLE "Assessment"
  ADD COLUMN "uploadStatus"         "UploadStatus" NOT NULL DEFAULT 'UPLOADED',
  ADD COLUMN "rawFileName"          TEXT,
  ADD COLUMN "entryCount"           INTEGER        NOT NULL DEFAULT 0,
  ADD COLUMN "matchedStudentCount"  INTEGER        NOT NULL DEFAULT 0,
  ADD COLUMN "expectedStudentCount" INTEGER,
  ADD COLUMN "notes"                TEXT;

-- ─── AssessmentResult: new columns ───────────────────────────────────────────

ALTER TABLE "AssessmentResult"
  ADD COLUMN "normalisedGrade"  TEXT,
  ADD COLUMN "candidateNumber"  TEXT,
  ADD COLUMN "isValid"          BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "validationNotes"  TEXT;
