ALTER TABLE "LoaReason" ADD COLUMN "requiresMedicalEvidence" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LOARequest" ADD COLUMN "inArbor" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LOARequest" ADD COLUMN "inITrent" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: mark existing reasons that already look medical, so the new
-- per-reason gate doesn't silently drop the medical-evidence requirement
-- for schools that already rely on it under a "Sick Leave"/"Medical" label.
UPDATE "LoaReason" SET "requiresMedicalEvidence" = true
WHERE "label" ILIKE '%medical%' OR "label" ILIKE '%sick%';
