import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/apiErrors";
import { findLinkedAccountInTenant } from "@/lib/linkedAccounts";
import { isActivePlatformSuperAdmin } from "@/lib/platform";
import { prisma } from "@/lib/prisma";
import { SHADOW_SUPER_ADMIN_RESET } from "@/lib/shadowSuperAdmin";

/**
 * Checks (and for platform super-admins, prepares) a switch to another school.
 * The session itself changes in the NextAuth jwt callback, which applies the
 * same rule: the person needs a linked account there (lib/linkedAccounts.ts).
 */
export async function POST(req: Request) {
  try {
    const currentUser = await getSessionUserOrThrow();

    const body = await req.json();
    const targetTenantId = typeof body?.tenantId === "string" ? body.tenantId : "";
    if (!targetTenantId) {
      return NextResponse.json({ error: "Missing tenantId" }, { status: 400 });
    }

    const linked = await findLinkedAccountInTenant(currentUser.id, targetTenantId);
    if (linked) return NextResponse.json({ success: true });

    // Platform super-admins get a god-mode account in any school. Trust comes from
    // the SUPER_ADMIN account they are signed in as, not from the email address.
    const isPlatformSuperAdmin =
      currentUser.role === "SUPER_ADMIN" && (await isActivePlatformSuperAdmin(currentUser.email));
    if (!isPlatformSuperAdmin) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: targetTenantId } });
    if (!tenant) {
      return NextResponse.json({ error: "School not found" }, { status: 404 });
    }

    await prisma.user.upsert({
      where: { tenantId_email: { tenantId: targetTenantId, email: currentUser.email } },
      update: { isActive: true, role: "SUPER_ADMIN", ...SHADOW_SUPER_ADMIN_RESET },
      create: {
        tenantId: targetTenantId,
        email: currentUser.email,
        fullName: currentUser.fullName,
        role: "SUPER_ADMIN",
        isActive: true,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
