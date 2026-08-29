import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminUser } from "@/lib/admin";
import { assertCsrfFromForm } from "@/lib/csrf";
import { withApi } from "@/lib/apiRoute";

export const POST = withApi(async function POST(req: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  const resolvedParams = await params;
  const actor = await requireSuperAdminUser();
  const form = await req.formData();
  try {
    await assertCsrfFromForm(form);
  } catch {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }
  const schoolType = String(form.get("schoolType") ?? "SECONDARY") as "PRIMARY" | "SECONDARY";
  if (!["PRIMARY", "SECONDARY"].includes(schoolType)) {
    return NextResponse.json({ error: "Invalid school type" }, { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: resolvedParams.tenantId } });
  if (!tenant) return NextResponse.json({ error: "School not found" }, { status: 404 });

  const before = await (prisma as any).tenantSettings.findUnique({ where: { tenantId: resolvedParams.tenantId } });

  await (prisma as any).tenantSettings.upsert({
    where: { tenantId: resolvedParams.tenantId },
    update: { schoolType },
    create: { tenantId: resolvedParams.tenantId, schoolName: tenant.name, schoolType },
  });

  await (prisma as any).auditLog.create({
    data: {
      tenantId: resolvedParams.tenantId,
      actorUserId: actor.id,
      action: "school.schoolType.update",
      targetType: "Tenant",
      targetId: resolvedParams.tenantId,
      beforeJson: { schoolType: before?.schoolType ?? "SECONDARY" },
      afterJson: { schoolType },
    },
  });

  return NextResponse.redirect(new URL(`/god/schools/${resolvedParams.tenantId}`, req.url));
});
