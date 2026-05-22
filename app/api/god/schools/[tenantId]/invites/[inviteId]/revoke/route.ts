import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminUser } from "@/lib/admin";
import { assertCsrfFromForm } from "@/lib/csrf";
import { withApi } from "@/lib/apiRoute";

export const POST = withApi(async function POST(req: Request, { params }: { params: Promise<{ tenantId: string; inviteId: string }> }) {
  const resolvedParams = await params;
  const actor = await requireSuperAdminUser();
  const form = await req.formData();
  try {
    await assertCsrfFromForm(form);
  } catch {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const invite = await (prisma as any).schoolAdminInvite.findFirst({
    where: { id: resolvedParams.inviteId, tenantId: resolvedParams.tenantId },
  });
  if (!invite) return NextResponse.json({ error: "Invite not found" }, { status: 404 });

  if (!invite.acceptedAt && new Date(invite.expiresAt).getTime() > Date.now()) {
    await (prisma as any).schoolAdminInvite.update({
      where: { id: invite.id },
      data: { expiresAt: new Date() },
    });
  }

  await (prisma as any).auditLog.create({
    data: {
      tenantId: resolvedParams.tenantId,
      actorUserId: actor.id,
      action: "school.admin.invite.revoke",
      targetType: "SchoolAdminInvite",
      targetId: invite.id,
      afterJson: { email: invite.email },
    },
  });

  return NextResponse.redirect(new URL(`/god/schools/${resolvedParams.tenantId}`, req.url));
});
