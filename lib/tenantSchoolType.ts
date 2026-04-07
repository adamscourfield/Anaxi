import { prisma } from "@/lib/prisma";

export type TenantSchoolType = "PRIMARY" | "SECONDARY";

export async function getTenantSchoolType(tenantId: string): Promise<TenantSchoolType> {
  const settings = await (prisma as any).tenantSettings.findUnique({
    where: { tenantId },
    select: { schoolType: true },
  });
  return (settings?.schoolType as TenantSchoolType) ?? "SECONDARY";
}
