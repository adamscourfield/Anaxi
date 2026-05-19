import { createHash } from "crypto";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApi } from "@/lib/apiRoute";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export const POST = withApi(async function POST(req: Request) {
  const form = await req.formData();
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");

  if (!token || password.length < 8) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const invite = await (prisma as any).schoolAdminInvite.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!invite) return NextResponse.json({ error: "Invalid invite" }, { status: 404 });
  if (invite.acceptedAt || new Date(invite.expiresAt).getTime() < Date.now()) {
    return NextResponse.json({ error: "Invite expired" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findFirst({ where: { tenantId: invite.tenantId, email: invite.email } });

    if (existing) {
      await tx.user.update({
        where: { id: existing.id },
        data: { fullName: invite.fullName, role: "ADMIN", isActive: true, passwordHash },
      });
    } else {
      await tx.user.create({
        data: {
          tenantId: invite.tenantId,
          email: invite.email,
          fullName: invite.fullName,
          role: "ADMIN",
          isActive: true,
          passwordHash,
          canApproveAllLoa: true,
        },
      });
    }

    await (tx as any).schoolAdminInvite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
    await (tx as any).auditLog.create({
      data: {
        tenantId: invite.tenantId,
        actorUserId: invite.invitedByUserId,
        action: "school.admin.invite.accepted",
        targetType: "SchoolAdminInvite",
        targetId: invite.id,
        afterJson: { email: invite.email },
      },
    });
  });

  return NextResponse.redirect(new URL("/login?invited=1", req.url));
});
