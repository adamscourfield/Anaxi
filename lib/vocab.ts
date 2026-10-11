import { prisma } from "@/lib/prisma";

export const DEFAULT_VOCAB: Record<string, { singular: string; plural: string }> = {
  positive_points: { singular: "Positive Point", plural: "Positive Points" },
  detentions: { singular: "Detention", plural: "Detentions" },
  internal_exclusions: { singular: "Internal Exclusion", plural: "Internal Exclusions" },
  on_calls: { singular: "On Call", plural: "On Calls" },
  suspensions: { singular: "Suspension", plural: "Suspensions" }
};

export async function getTenantVocab(tenantId: string) {
  const [rows, settings] = await Promise.all([
    prisma.tenantVocab.findMany({ where: { tenantId } }),
    prisma.tenantSettings.findUnique({ where: { tenantId } }),
  ]);
  const result: Record<string, { singular: string; plural: string }> = { ...DEFAULT_VOCAB };
  const behaviourLabels: Record<string, string | null | undefined> = {
    positive_points: settings?.positivePointsLabel,
    detentions: settings?.detentionLabel,
    internal_exclusions: settings?.internalExclusionLabel,
    on_calls: settings?.onCallLabel,
    suspensions: settings?.suspensionLabel,
  };
  for (const [key, label] of Object.entries(behaviourLabels)) {
    if (label?.trim() && label.trim() !== DEFAULT_VOCAB[key].singular && label.trim() !== DEFAULT_VOCAB[key].plural) {
      result[key] = { singular: label.trim(), plural: pluralLabel(label.trim()) };
    }
  }
  for (const row of rows) {
    result[row.key] = {
      singular: row.labelSingular.trim() || result[row.key]?.singular || row.key,
      plural: row.labelPlural.trim() || result[row.key]?.plural || pluralLabel(row.labelSingular.trim() || row.key),
    };
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
