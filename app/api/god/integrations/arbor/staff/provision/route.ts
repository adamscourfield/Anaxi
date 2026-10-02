import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { requireSuperAdminUser } from "@/lib/admin";
import { withApi } from "@/lib/apiRoute";
import { assertCsrfFromForm } from "@/lib/csrf";
import { sendOnboardingEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

const ROLES = new Set(["ADMIN", "SLT", "HOD", "LEADER", "TEACHER", "SUPPORT", "HR", "ON_CALL"]);

/** Creates approved account(s) only after a super admin has selected scope and role. */
export const POST = withApi(async function POST(req: Request) {
  const actor = await requireSuperAdminUser();
  const form = await req.formData();
  try { await assertCsrfFromForm(form); } catch { return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }); }
  const requestId = String(form.get("requestId") ?? "");
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const role = String(form.get("role") ?? "");
  const tenantIds = [...new Set(form.getAll("tenantId").map(String).filter(Boolean))];
  if (!requestId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !ROLES.has(role) || !tenantIds.length) {
    return NextResponse.redirect(new URL("/god/integrations/arbor?staffProvisioning=invalid", req.url));
  }
  const db = prisma as any;
  const request = await db.staffProvisioningRequest.findFirst({ where: { id: requestId, status: "PENDING" }, include: { integration: { include: { schools: { where: { enabled: true }, select: { tenantId: true } } } } } });
  if (!request) return NextResponse.redirect(new URL("/god/integrations/arbor?staffProvisioning=not-found", req.url));
  const enabled = new Set(request.integration.schools.map((school: { tenantId: string }) => school.tenantId));
  if (tenantIds.some((tenantId) => !enabled.has(tenantId))) return NextResponse.redirect(new URL("/god/integrations/arbor?staffProvisioning=invalid", req.url));
  try {
    const existing = await db.user.findFirst({ where: { email, isActive: true, tenantId: { notIn: tenantIds } }, select: { passwordHash: true } });
    const passwordHash = existing?.passwordHash ?? await bcrypt.hash("Password123!", 10);
    const users = [] as Array<{ id: string; tenantId: string }>;
    for (const tenantId of tenantIds) {
      const existingInSchool = await db.user.findUnique({ where: { tenantId_email: { tenantId, email } }, select: { id: true, externalId: true } });
      if (existingInSchool && existingInSchool.externalId && existingInSchool.externalId !== request.arborStaffId) throw new Error("This email is already linked to another Arbor staff record in the selected school.");
      if (existingInSchool) {
        await db.user.update({ where: { id: existingInSchool.id }, data: { fullName: request.fullName, role, isActive: true, externalId: request.arborStaffId, dataSource: "ARBOR", passwordHash } });
        users.push({ id: existingInSchool.id, tenantId });
      } else {
        const user = await db.user.create({ data: { tenantId, fullName: request.fullName, email, role, isActive: true, passwordHash, externalId: request.arborStaffId, dataSource: "ARBOR" } });
        users.push({ id: user.id, tenantId });
      }
    }
    await db.staffProvisioningRequest.update({ where: { id: request.id }, data: { email, status: "PROVISIONED", provisionedAt: new Date() } });
    await db.auditLog.create({ data: { tenantId: actor.tenantId, actorUserId: actor.id, action: "integration.arbor.staff_provisioned", targetType: "StaffProvisioningRequest", targetId: request.id, afterJson: { tenantIds, role } } });
    // Cross-school staff share credentials, so one onboarding email is sufficient.
    const onboardingUser = users[0];
    if (onboardingUser) sendOnboardingEmail({ to: email, fullName: request.fullName, tenantId: onboardingUser.tenantId, userId: onboardingUser.id }).catch(() => undefined);
    return NextResponse.redirect(new URL("/god/integrations/arbor?staffProvisioning=provisioned", req.url));
  } catch {
    return NextResponse.redirect(new URL("/god/integrations/arbor?staffProvisioning=failed", req.url));
  }
});
