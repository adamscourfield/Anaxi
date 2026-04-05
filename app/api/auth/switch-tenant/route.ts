import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
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

  const targetUser = await prisma.user.findFirst({
    where: { email: currentUser.email, tenantId: targetTenantId, isActive: true },
  });

  if (!targetUser) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  return NextResponse.json({ success: true });
}
