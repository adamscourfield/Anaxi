import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminUser } from "@/lib/admin";
import { assertCsrfFromForm } from "@/lib/csrf";

export async function POST(req: Request, { params }: { params: { tenantId: string } }) {
  const actor = await requireSuperAdminUser();
  const form = await req.formData();
  try {
    await assertCsrfFromForm(form);
  } catch {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }
  const status = String(form.get("status") ?? "ACTIVE") as "ACTIVE" | "PAUSED" | "ARCHIVED";
  if (!["ACTIVE", "PAUSED", "ARCHIVED"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const before = await prisma.tenant.findUnique({ where: { id: params.tenantId }, select: { status: true } });
  if (!before) return NextResponse.json({ error: "School not found" }, { status: 404 });

  const updated = await prisma.tenant.update({ where: { id: params.tenantId }, data: { status } });

  await (prisma as any).auditLog.create({
    data: {
      tenantId: updated.id,
      actorUserId: actor.id,
      action: "school.status.update",
      targetType: "Tenant",
      targetId: updated.id,
      beforeJson: before,
      afterJson: { status: updated.status },
    },
  });

  return NextResponse.redirect(new URL(`/god/schools/${params.tenantId}`, req.url));
}
