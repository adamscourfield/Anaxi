import "server-only";
import { prisma } from "@/lib/prisma";
import { pluralLabel } from "@/lib/vocab";
import { defaultClassLabels } from "./presentation";
export async function classSettings(tenantId: string) {
  const [settings, vocab, integration] = await Promise.all([
    prisma.tenantSettings.findUnique({ where: { tenantId } }),
    prisma.tenantVocab.findMany({ where: { tenantId } }),
    prisma.sharedIntegration.findFirst({ where: { provider: "ARBOR", status: "CONNECTED", schools: { some: { tenantId, enabled: true } } }, select: { config: true } }),
  ]);
  const term = (key: string, fallback: string) => vocab.find(v => v.key === key)?.labelPlural?.trim() || fallback;
  const labels = { ...defaultClassLabels,
    positive: term("positive_points", settings?.positivePointsLabel || defaultClassLabels.positive),
    negative: settings?.negativePointsLabel || defaultClassLabels.negative,
    detention: term("detentions", pluralLabel(settings?.detentionLabel || "Detention")),
    onCall: term("on_calls", pluralLabel(settings?.onCallLabel || "On Call")),
    internalExclusion: term("internal_exclusions", pluralLabel(settings?.internalExclusionLabel || "Internal Exclusion")),
    suspension: term("suspensions", pluralLabel(settings?.suspensionLabel || "Suspension")),
  };
  const config = integration?.config as Record<string, unknown> | undefined;
  const synced = typeof config?.behaviourLastSyncedDate === "string" ? config.behaviourLastSyncedDate : null;
  return { labels, behaviourThrough: integration ? synced : undefined };
}
