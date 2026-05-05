-- CreateEnum
CREATE TYPE "OnCallTimelineEventType" AS ENUM ('CREATED', 'ACKNOWLEDGED', 'RESOLVED', 'CANCELLED');

-- CreateTable
CREATE TABLE "OnCallTimelineEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "type" "OnCallTimelineEventType" NOT NULL,
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnCallTimelineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OnCallTimelineEvent_tenantId_idx" ON "OnCallTimelineEvent"("tenantId");

CREATE INDEX "OnCallTimelineEvent_requestId_idx" ON "OnCallTimelineEvent"("requestId");

CREATE INDEX "OnCallTimelineEvent_tenantId_requestId_createdAt_idx" ON "OnCallTimelineEvent"("tenantId", "requestId", "createdAt");

-- AddForeignKey
ALTER TABLE "OnCallTimelineEvent" ADD CONSTRAINT "OnCallTimelineEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OnCallTimelineEvent" ADD CONSTRAINT "OnCallTimelineEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "OnCallRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OnCallTimelineEvent" ADD CONSTRAINT "OnCallTimelineEvent_tenantId_actorUserId_fkey" FOREIGN KEY ("tenantId", "actorUserId") REFERENCES "User"("tenantId", "id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill from existing OnCallRequest rows
INSERT INTO "OnCallTimelineEvent" ("id", "tenantId", "requestId", "type", "actorUserId", "createdAt")
SELECT gen_random_uuid()::text, "tenantId", "id", 'CREATED'::"OnCallTimelineEventType", "requesterUserId", "createdAt"
FROM "OnCallRequest";

INSERT INTO "OnCallTimelineEvent" ("id", "tenantId", "requestId", "type", "actorUserId", "createdAt")
SELECT gen_random_uuid()::text, "tenantId", "id", 'ACKNOWLEDGED'::"OnCallTimelineEventType", "responderUserId", "acknowledgedAt"
FROM "OnCallRequest"
WHERE "acknowledgedAt" IS NOT NULL;

INSERT INTO "OnCallTimelineEvent" ("id", "tenantId", "requestId", "type", "actorUserId", "createdAt")
SELECT gen_random_uuid()::text, "tenantId", "id", 'RESOLVED'::"OnCallTimelineEventType", "responderUserId", "resolvedAt"
FROM "OnCallRequest"
WHERE "resolvedAt" IS NOT NULL;

INSERT INTO "OnCallTimelineEvent" ("id", "tenantId", "requestId", "type", "actorUserId", "createdAt")
SELECT gen_random_uuid()::text, "tenantId", "id", 'CANCELLED'::"OnCallTimelineEventType", "requesterUserId", "updatedAt"
FROM "OnCallRequest"
WHERE "status" = 'CANCELLED';
