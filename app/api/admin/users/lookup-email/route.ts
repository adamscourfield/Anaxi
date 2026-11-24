import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { withApi } from "@/lib/apiRoute";

/**
 * Tells an admin whether an email they're about to add can be linked to an
 * account at another school (one that already has a password), so the person
 * keeps one password across schools. Deliberately says nothing else: not which
 * school, their name or their role. That is another school's data.
 */
export const GET = withApi(async function GET(req: Request) {
  const admin = await requireAdminUser();
  const { searchParams } = new URL(req.url);
  const email = String(searchParams.get("email") || "").trim().toLowerCase();
  if (!email) return NextResponse.json({ canLink: false });

  const linkable = await prisma.user.findFirst({
    where: { email, isActive: true, tenantId: { not: admin.tenantId }, passwordHash: { not: null } },
    select: { id: true },
  });

  return NextResponse.json({ canLink: Boolean(linkable) });
});
