import { NextResponse } from "next/server";
import { requireSuperAdminUser } from "@/lib/admin";
import { isActivePlatformSuperAdmin } from "@/lib/platform";
import { prisma } from "@/lib/prisma";
import { withApi } from "@/lib/apiRoute";
import { SHADOW_SUPER_ADMIN_RESET } from "@/lib/shadowSuperAdmin";

export const POST = withApi(async function POST(req: Request) {
  const actor = await requireSuperAdminUser();
  if (!(await isActivePlatformSuperAdmin(actor.email))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const body = await req.json();
  const targetTenantId = body.tenantId as string;
  if (!targetTenantId) {
    return NextResponse.json({ error: "Missing tenantId" }, { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: targetTenantId } });
  if (!tenant) {
    return NextResponse.json({ error: "School not found" }, { status: 404 });
  }

  // Ensure the SUPER_ADMIN has a user record in the target school.
  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: targetTenantId, email: actor.email } },
    update: { isActive: true, role: "SUPER_ADMIN", ...SHADOW_SUPER_ADMIN_RESET },
    create: {
      tenantId: targetTenantId,
      email: actor.email,
      fullName: actor.fullName,
      role: "SUPER_ADMIN",
      isActive: true,
    },
  });

  return NextResponse.json({ success: true });
});
