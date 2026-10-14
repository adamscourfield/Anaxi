-- Preserve availability of the previously always-visible Strategy Board.
INSERT INTO "TenantFeature" ("id", "tenantId", "key", "enabled")
SELECT 'strategy_' || "id", "id", 'STRATEGY', true FROM "Tenant"
ON CONFLICT ("tenantId", "key") DO NOTHING;
