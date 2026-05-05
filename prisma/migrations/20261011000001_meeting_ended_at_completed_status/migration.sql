-- AlterTable
ALTER TABLE "Meeting" ADD COLUMN "endedAt" TIMESTAMP(3);

-- Live sessions were incorrectly marked CANCELLED when ended; recover duration and mark as completed (CONFIRMED + endedAt).
UPDATE "Meeting"
SET "endedAt" = COALESCE("endDateTime", "updatedAt")
WHERE "status" = 'CANCELLED' AND "startedAt" IS NOT NULL;

UPDATE "Meeting"
SET "status" = 'CONFIRMED'
WHERE "status" = 'CANCELLED' AND "startedAt" IS NOT NULL;
