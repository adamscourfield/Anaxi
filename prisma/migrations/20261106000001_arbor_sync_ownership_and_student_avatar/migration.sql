-- AlterTable
ALTER TABLE "Assessment" ADD COLUMN     "dataSource" "DataSource" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "externalId" TEXT;

-- AlterTable
ALTER TABLE "AssessmentCycle" ADD COLUMN     "dataSource" "DataSource" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "externalId" TEXT;

-- AlterTable
ALTER TABLE "AssessmentPoint" ADD COLUMN     "dataSource" "DataSource" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "externalId" TEXT;

-- AlterTable
ALTER TABLE "AssessmentResult" ADD COLUMN     "dataSource" "DataSource" NOT NULL DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "avatarImage" BYTEA,
ADD COLUMN     "avatarMimeType" TEXT,
ADD COLUMN     "avatarUpdatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "StudentSnapshot" ADD COLUMN     "dataSource" "DataSource" NOT NULL DEFAULT 'MANUAL';

-- CreateIndex
CREATE UNIQUE INDEX "Assessment_tenantId_dataSource_externalId_key" ON "Assessment"("tenantId", "dataSource", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentCycle_tenantId_dataSource_externalId_key" ON "AssessmentCycle"("tenantId", "dataSource", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentPoint_tenantId_dataSource_externalId_key" ON "AssessmentPoint"("tenantId", "dataSource", "externalId");

