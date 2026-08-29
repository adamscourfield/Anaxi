-- AlterTable
ALTER TABLE "User" ADD COLUMN "avatarImage" BYTEA,
ADD COLUMN "avatarMimeType" TEXT,
ADD COLUMN "avatarUpdatedAt" TIMESTAMP(3);
