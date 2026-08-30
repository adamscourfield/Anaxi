-- OnCallRecipient must reference a real staff User rather than a bare
-- email string, so someone with no account in the system can't be added
-- as a recipient of live safeguarding/behaviour incident data.
--
-- Also add per-recipient notification scope (notifiesBehaviour /
-- notifiesFirstAid), mirroring the existing per-user
-- receivesOnCallEmails/receivesFirstAidEmails flags. Defaults preserve
-- existing behaviour: every recipient keeps receiving both types.

ALTER TABLE "OnCallRecipient" ADD COLUMN "userId" TEXT;

-- Backfill userId by matching each recipient's email to a User in the same tenant.
UPDATE "OnCallRecipient" r
SET "userId" = u."id"
FROM "User" u
WHERE u."tenantId" = r."tenantId" AND u."email" = r."email";

-- Rows that don't match an existing staff account can't be carried forward
-- under the new "must be a real user" rule.
DELETE FROM "OnCallRecipient" WHERE "userId" IS NULL;

ALTER TABLE "OnCallRecipient" ALTER COLUMN "userId" SET NOT NULL;

DROP INDEX IF EXISTS "OnCallRecipient_tenantId_email_key";
ALTER TABLE "OnCallRecipient" DROP COLUMN "email";

ALTER TABLE "OnCallRecipient" ADD COLUMN "notifiesBehaviour" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "OnCallRecipient" ADD COLUMN "notifiesFirstAid" BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX "OnCallRecipient_tenantId_userId_key" ON "OnCallRecipient"("tenantId", "userId");

ALTER TABLE "OnCallRecipient" ADD CONSTRAINT "OnCallRecipient_tenantId_userId_fkey"
  FOREIGN KEY ("tenantId", "userId") REFERENCES "User"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
