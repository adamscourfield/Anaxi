-- LOA: decision audit fields + legacy status normalisation
ALTER TABLE "LOARequest" ADD COLUMN IF NOT EXISTS "decisionNotes" TEXT;
ALTER TABLE "LOARequest" ADD COLUMN IF NOT EXISTS "decidedById" TEXT;
ALTER TABLE "LOARequest" ADD COLUMN IF NOT EXISTS "decidedAt" TIMESTAMP(3);

UPDATE "LOARequest" SET "status" = 'APPROVED_WITH_PAY' WHERE "status" = 'APPROVED';
