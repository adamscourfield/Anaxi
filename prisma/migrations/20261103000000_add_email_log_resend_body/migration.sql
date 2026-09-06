-- Store the rendered email body so a failed send can be resent verbatim
-- without re-deriving business data (which may have since changed).
ALTER TABLE "EmailLog" ADD COLUMN "bodyText" TEXT;
ALTER TABLE "EmailLog" ADD COLUMN "bodyHtml" TEXT;
ALTER TABLE "EmailLog" ADD COLUMN "attachmentsJson" JSONB;
