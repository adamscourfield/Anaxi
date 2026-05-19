-- AlterTable
ALTER TABLE "ImportJob" ADD COLUMN "mappingJson" JSONB;

-- AlterTable
ALTER TABLE "MeetingAction" ADD COLUMN "blockReason" TEXT;
