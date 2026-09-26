-- CreateEnum
CREATE TYPE "DataSource" AS ENUM ('MANUAL', 'CSV_IMPORT', 'ARBOR');

-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('ARBOR');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('DISCONNECTED', 'CONNECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "IntegrationSyncStatus" AS ENUM ('RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "IntegrationEntityType" AS ENUM ('STAFF', 'STUDENTS', 'CLASSES', 'BEHAVIOUR', 'ASSESSMENTS');

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "dataSource" "DataSource" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "externalId" TEXT;

-- AlterTable
ALTER TABLE "TimetableEntry" ADD COLUMN     "dataSource" "DataSource" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "externalId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "dataSource" "DataSource" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "externalId" TEXT;

-- CreateTable
CREATE TABLE "TenantIntegration" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
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

    CONSTRAINT "TenantIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationSyncRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
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

    CONSTRAINT "IntegrationSyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantIntegration_tenantId_provider_key" ON "TenantIntegration"("tenantId", "provider");

-- CreateIndex
CREATE INDEX "IntegrationSyncRun_tenantId_integrationId_startedAt_idx" ON "IntegrationSyncRun"("tenantId", "integrationId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Student_tenantId_dataSource_externalId_key" ON "Student"("tenantId", "dataSource", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "TimetableEntry_tenantId_dataSource_externalId_key" ON "TimetableEntry"("tenantId", "dataSource", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_dataSource_externalId_key" ON "User"("tenantId", "dataSource", "externalId");

-- AddForeignKey
ALTER TABLE "TenantIntegration" ADD CONSTRAINT "TenantIntegration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationSyncRun" ADD CONSTRAINT "IntegrationSyncRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationSyncRun" ADD CONSTRAINT "IntegrationSyncRun_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "TenantIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

