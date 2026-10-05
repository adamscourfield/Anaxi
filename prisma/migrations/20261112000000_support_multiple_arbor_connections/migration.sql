-- A shared MIS connection belongs to one real school. Goresbrook's existing
-- connection is retained, while future schools can supply their own credentials.
DROP INDEX IF EXISTS "SharedIntegration_provider_key";

ALTER TABLE "SharedIntegration"
  ADD COLUMN "label" TEXT NOT NULL DEFAULT 'Existing Arbor connection';

CREATE UNIQUE INDEX "SharedIntegration_provider_label_key"
  ON "SharedIntegration"("provider", "label");
CREATE INDEX "SharedIntegration_provider_idx"
  ON "SharedIntegration"("provider");
