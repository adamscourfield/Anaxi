import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const currentUser = (session as any)?.user;
  if (!currentUser?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const targetTenantId = body.tenantId as string;
  if (!targetTenantId) {
    return NextResponse.json({ error: "Missing tenantId" }, { status: 400 });
  }

  const isSuperAdmin = currentUser.role === "SUPER_ADMIN";

  let targetUser = await prisma.user.findFirst({
    where: { email: currentUser.email, tenantId: targetTenantId, isActive: true },
  });

  if (!targetUser) {
    if (!isSuperAdmin) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    // Auto-enroll SUPER_ADMIN in any school they switch to.
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
}
