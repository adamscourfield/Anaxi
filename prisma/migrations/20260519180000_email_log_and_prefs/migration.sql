-- Email delivery log
CREATE TYPE "EmailDeliveryStatus" AS ENUM ('SENT', 'FAILED', 'NOT_CONFIGURED');

CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "template" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "EmailDeliveryStatus" NOT NULL,
    "providerId" TEXT,
    "errorMessage" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmailLog_tenantId_createdAt_idx" ON "EmailLog"("tenantId", "createdAt");
CREATE INDEX "EmailLog_status_createdAt_idx" ON "EmailLog"("status", "createdAt");

ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- User notification preferences
ALTER TABLE "User" ADD COLUMN "emailObservations" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "emailMeetings" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "emailLeave" BOOLEAN NOT NULL DEFAULT true;

-- Import job file storage for retry
ALTER TABLE "ImportJob" ADD COLUMN "storagePath" TEXT;

-- One open flag per student/key (prevents duplicate cron inserts)
CREATE UNIQUE INDEX "StudentChangeFlag_open_unique" ON "StudentChangeFlag" ("tenantId", "studentId", "flagKey") WHERE "resolvedAt" IS NULL;
