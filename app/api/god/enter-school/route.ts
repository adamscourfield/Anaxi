import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { requireSuperAdminUser } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { withApi } from "@/lib/apiRoute";

export const POST = withApi(async function POST(req: Request) {
  const actor = await requireSuperAdminUser();

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
    update: { isActive: true, role: "SUPER_ADMIN" },
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
