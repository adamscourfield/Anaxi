import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { withApi } from "@/lib/apiRoute";

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Administrator",
  SLT: "Senior Leader",
  HOD: "Head of Dept",
  LEADER: "Leader",
  TEACHER: "Teacher",
  SUPPORT: "Support",
  HR: "HR Officer",
  ON_CALL: "On-Call Staff",
};

/**
 * Tells an admin whether an email they're about to add already has an
 * active account at another school, so they can link accounts (share the
 * same password) instead of creating a fully separate one. Never returns
 * the password or which tenant, just enough to inform the decision.
 */
export const GET = withApi(async function GET(req: Request) {
  const admin = await requireAdminUser();
  const { searchParams } = new URL(req.url);
  const email = String(searchParams.get("email") || "").trim().toLowerCase();
  if (!email) return NextResponse.json({ accounts: [] });

  const existing = await prisma.user.findMany({
    where: {
      email,
      isActive: true,
      tenantId: { not: admin.tenantId },
    },
    select: { fullName: true, role: true, passwordHash: true, tenant: { select: { name: true } } },
  });

  return NextResponse.json({
    accounts: existing.map((u) => ({
      fullName: u.fullName,
      roleLabel: ROLE_LABELS[u.role] ?? u.role,
      schoolName: u.tenant?.name ?? "another school",
      hasPassword: u.passwordHash != null,
    })),
  });
});
