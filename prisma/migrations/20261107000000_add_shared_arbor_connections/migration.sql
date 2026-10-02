-- One Arbor system can serve several Anaxi school tenants. Store its encrypted
-- credentials once and keep the selected Anaxi destinations as relational links.
CREATE TABLE "SharedIntegration" (
    "id" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "credentialsCiphertext" TEXT,
    "config" JSONB,
    "connectedByUserId" TEXT,
    "connectedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncStatus" "IntegrationSyncStatus",
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SharedIntegration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SharedIntegrationSchool" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SharedIntegrationSchool_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SharedIntegration_provider_key" ON "SharedIntegration"("provider");
CREATE UNIQUE INDEX "SharedIntegrationSchool_integrationId_tenantId_key" ON "SharedIntegrationSchool"("integrationId", "tenantId");
CREATE INDEX "SharedIntegrationSchool_tenantId_idx" ON "SharedIntegrationSchool"("tenantId");

ALTER TABLE "SharedIntegrationSchool" ADD CONSTRAINT "SharedIntegrationSchool_integrationId_fkey"
  FOREIGN KEY ("integrationId") REFERENCES "SharedIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SharedIntegrationSchool" ADD CONSTRAINT "SharedIntegrationSchool_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
