import { PLATFORM_TENANT_ID } from "@/lib/constants";

export function microsoftEnabled() {
  return Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET);
}

/** Only explicitly provisioned directory identities can access existing staff accounts. */
export async function resolveMicrosoftUser(profile: Record<string, unknown> | undefined) {
  const tid = profile?.tid;
  const oid = profile?.oid;
  if (typeof tid !== "string" || typeof oid !== "string" || !tid || !oid) return null;
  const { prisma } = await import("@/lib/prisma");
  return prisma.user.findFirst({
    where: {
      microsoftTenantId: tid,
      microsoftObjectId: oid,
      isActive: true,
      role: { not: "SUPER_ADMIN" },
      tenantId: { not: PLATFORM_TENANT_ID },
      email: { not: "hi@anaxi.io", mode: "insensitive" },
    },
    orderBy: [{ tenantId: "asc" }, { id: "asc" }],
    select: { id: true, tenantId: true, email: true, fullName: true, role: true, isActive: true },
  });
}
