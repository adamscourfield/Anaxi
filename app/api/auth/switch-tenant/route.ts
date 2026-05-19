import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/apiErrors";
import { isActivePlatformSuperAdmin } from "@/lib/platform";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const currentUser = await getSessionUserOrThrow();

    const body = await req.json();
    const targetTenantId = body.tenantId as string;
    if (!targetTenantId) {
      return NextResponse.json({ error: "Missing tenantId" }, { status: 400 });
    }

    let targetUser = await prisma.user.findFirst({
      where: { email: currentUser.email, tenantId: targetTenantId, isActive: true },
    });

    if (!targetUser) {
      const canEnroll = await isActivePlatformSuperAdmin(currentUser.email);
      if (!canEnroll) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }

      const tenant = await prisma.tenant.findUnique({ where: { id: targetTenantId } });
      if (!tenant) {
        return NextResponse.json({ error: "School not found" }, { status: 404 });
      }

      targetUser = await prisma.user.upsert({
        where: { tenantId_email: { tenantId: targetTenantId, email: currentUser.email } },
        update: { isActive: true, role: "SUPER_ADMIN" },
        create: {
          tenantId: targetTenantId,
          email: currentUser.email,
          fullName: currentUser.fullName,
          role: "SUPER_ADMIN",
          isActive: true,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
