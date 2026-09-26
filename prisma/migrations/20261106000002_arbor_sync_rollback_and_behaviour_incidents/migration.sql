-- CreateEnum
CREATE TYPE "IntegrationChangeType" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- CreateEnum
CREATE TYPE "BehaviourIncidentCategory" AS ENUM ('DETENTION', 'INTERNAL_EXCLUSION', 'SUSPENSION', 'POSITIVE_POINTS', 'LATENESS');

-- CreateTable
CREATE TABLE "BehaviourIncident" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "category" "BehaviourIncidentCategory" NOT NULL,
    "points" INTEGER,
    "reasonCode" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "externalId" TEXT,
    "dataSource" "DataSource" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BehaviourIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationSyncChange" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "syncRunId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "changeType" "IntegrationChangeType" NOT NULL,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "revertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationSyncChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BehaviourIncident_tenantId_studentId_category_occurredAt_idx" ON "BehaviourIncident"("tenantId", "studentId", "category", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "BehaviourIncident_tenantId_dataSource_externalId_key" ON "BehaviourIncident"("tenantId", "dataSource", "externalId");

-- CreateIndex
CREATE INDEX "IntegrationSyncChange_tenantId_syncRunId_idx" ON "IntegrationSyncChange"("tenantId", "syncRunId");

-- CreateIndex
CREATE INDEX "IntegrationSyncChange_tenantId_entityType_entityId_createdA_idx" ON "IntegrationSyncChange"("tenantId", "entityType", "entityId", "createdAt");

-- AddForeignKey
ALTER TABLE "BehaviourIncident" ADD CONSTRAINT "BehaviourIncident_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BehaviourIncident" ADD CONSTRAINT "BehaviourIncident_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationSyncChange" ADD CONSTRAINT "IntegrationSyncChange_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationSyncChange" ADD CONSTRAINT "IntegrationSyncChange_syncRunId_fkey" FOREIGN KEY ("syncRunId") REFERENCES "IntegrationSyncRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

