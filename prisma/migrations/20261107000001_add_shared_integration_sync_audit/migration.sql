CREATE TABLE "SharedIntegrationSyncRun" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "entityType" "IntegrationEntityType" NOT NULL,
    "status" "IntegrationSyncStatus" NOT NULL DEFAULT 'RUNNING',
    "recordsProcessed" INTEGER NOT NULL DEFAULT 0,
    "recordsCreated" INTEGER NOT NULL DEFAULT 0,
    "recordsUpdated" INTEGER NOT NULL DEFAULT 0,
    "recordsFailed" INTEGER NOT NULL DEFAULT 0,
    "errorSummary" TEXT,
    "triggeredBy" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    CONSTRAINT "SharedIntegrationSyncRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SharedIntegrationSyncChange" (
    "id" TEXT NOT NULL,
    "syncRunId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "changeType" "IntegrationChangeType" NOT NULL,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SharedIntegrationSyncChange_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SharedIntegrationSyncRun_integrationId_startedAt_idx" ON "SharedIntegrationSyncRun"("integrationId", "startedAt");
CREATE INDEX "SharedIntegrationSyncChange_syncRunId_idx" ON "SharedIntegrationSyncChange"("syncRunId");
CREATE INDEX "SharedIntegrationSyncChange_tenantId_entityType_entityId_createdAt_idx" ON "SharedIntegrationSyncChange"("tenantId", "entityType", "entityId", "createdAt");

ALTER TABLE "SharedIntegrationSyncRun" ADD CONSTRAINT "SharedIntegrationSyncRun_integrationId_fkey"
  FOREIGN KEY ("integrationId") REFERENCES "SharedIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SharedIntegrationSyncChange" ADD CONSTRAINT "SharedIntegrationSyncChange_syncRunId_fkey"
  FOREIGN KEY ("syncRunId") REFERENCES "SharedIntegrationSyncRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
