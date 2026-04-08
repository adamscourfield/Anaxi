-- AlterTable
ALTER TABLE "StudentSnapshot" ADD COLUMN "negativePointsTotal" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "TenantSettings" ADD COLUMN "negativePointsLabel" TEXT NOT NULL DEFAULT 'Negative Points';
