import { prisma } from "@/lib/prisma";
import { PLATFORM_TENANT_ID } from "@/lib/constants";

/** True when the email has an active SUPER_ADMIN on the platform tenant. */
export async function isActivePlatformSuperAdmin(email: string): Promise<boolean> {
  const normalized = email.toLowerCase().trim();
  const user = await prisma.user.findFirst({
    where: {
      email: normalized,
      tenantId: PLATFORM_TENANT_ID,
      role: "SUPER_ADMIN",
      isActive: true,
    },
    select: { id: true },
  });
  return Boolean(user);
}
