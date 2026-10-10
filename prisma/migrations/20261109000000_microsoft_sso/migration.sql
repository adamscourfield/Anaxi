ALTER TABLE "User" ADD COLUMN "microsoftTenantId" TEXT, ADD COLUMN "microsoftObjectId" TEXT;
CREATE UNIQUE INDEX "User_tenantId_microsoftTenantId_microsoftObjectId_key" ON "User"("tenantId", "microsoftTenantId", "microsoftObjectId");
CREATE INDEX "User_microsoftTenantId_microsoftObjectId_idx" ON "User"("microsoftTenantId", "microsoftObjectId");
