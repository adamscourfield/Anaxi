import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature, requireRole } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { SignalKey } from "@/modules/observations/signalDefinitions";

export type TenantSignalLabelMap = Partial<Record<SignalKey, { displayName: string; description?: string }>>;

export async function getTenantSignalLabels(tenantId: string): Promise<TenantSignalLabelMap> {
  const user = await getSessionUserOrThrow();
  if (user.tenantId !== tenantId) throw new Error("FORBIDDEN");
  await requireFeature(tenantId, "OBSERVATIONS");

  const rows = await (prisma as any).tenantSignalLabel.findMany({ where: { tenantId } });
  const map: TenantSignalLabelMap = {};
  for (const row of rows as any[]) {
    const signalKey = row.signalKey as SignalKey;
    map[signalKey] = { displayName: row.displayName, ...(row.description ? { description: row.description } : {}) };
  }
  return map;
}

export async function upsertTenantSignalLabel(tenantId: string, signalKey: SignalKey, displayName: string, description?: string | null) {
  const user = await getSessionUserOrThrow();
  if (user.tenantId !== tenantId) throw new Error("FORBIDDEN");
  await requireFeature(tenantId, "OBSERVATIONS");
  requireRole(user, ["ADMIN", "SUPER_ADMIN"]);

  const cleanedName = displayName.trim();
  if (cleanedName.length < 2 || cleanedName.length > 80) throw new Error("INVALID_DISPLAY_NAME");
  const cleanedDescription = (description || "").trim();
  if (cleanedDescription.length > 240) throw new Error("INVALID_DESCRIPTION");

  return (prisma as any).tenantSignalLabel.upsert({
    where: { tenantId_signalKey: { tenantId, signalKey } },
    create: {
      tenantId,
      signalKey,
      displayName: cleanedName,
      description: cleanedDescription || null
    },
    update: {
      displayName: cleanedName,
      description: cleanedDescription || null
    }
  });
}
