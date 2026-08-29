import { prisma } from "@/lib/prisma";

export const DEFAULT_VOCAB: Record<string, { singular: string; plural: string }> = {
  positive_points: { singular: "Positive Point", plural: "Positive Points" },
  detentions: { singular: "Detention", plural: "Detentions" },
  internal_exclusions: { singular: "Internal Exclusion", plural: "Internal Exclusions" },
  on_calls: { singular: "On Call", plural: "On Calls" },
  suspensions: { singular: "Suspension", plural: "Suspensions" }
};

export async function getTenantVocab(tenantId: string) {
  const rows = await prisma.tenantVocab.findMany({ where: { tenantId } });
  const result: Record<string, { singular: string; plural: string }> = { ...DEFAULT_VOCAB };
  for (const row of rows) {
    result[row.key] = { singular: row.labelSingular, plural: row.labelPlural };
  }
  return result;
}

/** Avoid double "s" when a tenant label is already plural (e.g. "Detentions"). */
export function pluralLabel(base: string): string {
  const t = base.trim();
  if (!t) return base;
  if (/s$/i.test(t)) return t;
  return `${t}s`;
}
