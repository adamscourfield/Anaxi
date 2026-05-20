import { ALL_FEATURE_KEYS } from "@/lib/types";

export type TenantFeatureRow = { key: string; enabled: boolean };

/** Merge canonical module keys with tenant DB rows (stable order for admin UI). */
export function buildTenantFeatureList(
  rows: Array<{ key: string; enabled: boolean }>,
): TenantFeatureRow[] {
  const byKey = new Map(rows.map((row) => [row.key, row.enabled]));
  const keys = new Set<string>([...ALL_FEATURE_KEYS, ...rows.map((row) => row.key)]);

  return Array.from(keys)
    .sort((a, b) => a.localeCompare(b))
    .map((key) => ({
      key,
      enabled: byKey.get(key) ?? false,
    }));
}
