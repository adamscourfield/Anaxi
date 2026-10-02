CREATE TYPE "StaffProvisioningStatus" AS ENUM ('PENDING', 'PROVISIONED', 'DISMISSED');

CREATE TABLE "StaffProvisioningRequest" (
  "id" TEXT NOT NULL,
  "integrationId" TEXT NOT NULL,
  "arborStaffId" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "email" TEXT,
  "isTeachingStaff" BOOLEAN NOT NULL DEFAULT false,
  "status" "StaffProvisioningStatus" NOT NULL DEFAULT 'PENDING',
  "provisionedAt" TIMESTAMP(3),
  "dismissedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StaffProvisioningRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StaffProvisioningRequest_integrationId_arborStaffId_key"
  ON "StaffProvisioningRequest"("integrationId", "arborStaffId");
CREATE INDEX "StaffProvisioningRequest_integrationId_status_createdAt_idx"
  ON "StaffProvisioningRequest"("integrationId", "status", "createdAt");
ALTER TABLE "StaffProvisioningRequest"
  ADD CONSTRAINT "StaffProvisioningRequest_integrationId_fkey"
  FOREIGN KEY ("integrationId") REFERENCES "SharedIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
