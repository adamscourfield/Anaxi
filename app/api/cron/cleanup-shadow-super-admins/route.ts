import { NextResponse } from "next/server";
import { assertCronAuthorized } from "@/lib/cronAuth";
import { PLATFORM_TENANT_ID } from "@/lib/constants";
import { isActivePlatformSuperAdmin } from "@/lib/platform";
import { prisma } from "@/lib/prisma";

/**
 * Cron: deactivate school-tenant SUPER_ADMIN rows when the email no longer has
 * an active platform super-admin account (stale shadow access).
 */
export async function POST(req: Request) {
  const denied = assertCronAuthorized(req);
  if (denied) return denied;

  const shadows = await prisma.user.findMany({
    where: {
      role: "SUPER_ADMIN",
      tenantId: { not: PLATFORM_TENANT_ID },
      isActive: true,
    },
    select: { id: true, email: true, tenantId: true },
    take: 500,
  });

  let deactivated = 0;
  for (const user of shadows) {
    const allowed = await isActivePlatformSuperAdmin(user.email);
    if (allowed) continue;
    await prisma.user.update({
      where: { id: user.id },
      data: { isActive: false },
    });
    deactivated++;
  }

  return NextResponse.json({
    scanned: shadows.length,
    deactivated,
    checkedAt: new Date().toISOString(),
  });
}

/** Vercel Cron always triggers via GET. */
export const GET = POST;
