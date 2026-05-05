-- LoaReason: display order for admin UI
ALTER TABLE "LoaReason" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- On-call taxonomy rows: soft-delete visibility + ordering (were missing from early schema)
ALTER TABLE "OnCallReason" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "OnCallReason" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "OnCallLocation" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "OnCallLocation" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "OnCallRecipient" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "OnCallRecipient" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- Backfill sortOrder from stable alphabetical order per tenant
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "tenantId" ORDER BY "label" ASC) - 1 AS rn FROM "LoaReason"
)
UPDATE "LoaReason" r SET "sortOrder" = n.rn FROM numbered n WHERE r.id = n.id;

WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "tenantId" ORDER BY "label" ASC) - 1 AS rn FROM "OnCallReason"
)
UPDATE "OnCallReason" r SET "sortOrder" = n.rn FROM numbered n WHERE r.id = n.id;

WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "tenantId" ORDER BY "label" ASC) - 1 AS rn FROM "OnCallLocation"
)
UPDATE "OnCallLocation" r SET "sortOrder" = n.rn FROM numbered n WHERE r.id = n.id;

WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "tenantId" ORDER BY "email" ASC) - 1 AS rn FROM "OnCallRecipient"
)
UPDATE "OnCallRecipient" r SET "sortOrder" = n.rn FROM numbered n WHERE r.id = n.id;
