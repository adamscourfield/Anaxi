-- schema.prisma was edited in #403 (2026-05-18) to add Progress8Benchmark and
-- the two Student KS2 columns below, but no migration was ever generated for
-- them -- this backfills that gap.

-- CreateTable
CREATE TABLE "Progress8Benchmark" (
    "id" TEXT NOT NULL,
    "ks2AverageScaledScore" INTEGER NOT NULL,
    "expectedAttainment8" DOUBLE PRECISION NOT NULL,
    "zeroProgress8GradeEquivalent" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Progress8Benchmark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Progress8Benchmark_ks2AverageScaledScore_key" ON "Progress8Benchmark"("ks2AverageScaledScore");

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "ks2MathsScaledScore" INTEGER,
ADD COLUMN     "ks2ReadingScaledScore" INTEGER;

-- AlterTable: drop the backfill default left over from 20261005500000_assessment_schema_redesign
-- (Prisma manages @updatedAt at the client level; no DB-level default is desired)
ALTER TABLE "AssessmentPoint" ALTER COLUMN "updatedAt" DROP DEFAULT;
