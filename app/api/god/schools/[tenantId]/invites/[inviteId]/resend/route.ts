import { createHash, randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminUser } from "@/lib/admin";
import { godInviteCookieName } from "@/lib/godInviteCookie";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(req: Request, { params }: { params: { tenantId: string; inviteId: string } }) {
  const actor = await requireSuperAdminUser();

  const invite = await (prisma as any).schoolAdminInvite.findFirst({
    where: { id: params.inviteId, tenantId: params.tenantId },
  });
  if (!invite) return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  if (invite.acceptedAt) return NextResponse.json({ error: "Invite already accepted" }, { status: 400 });

  const token = randomBytes(24).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

  await (prisma as any).schoolAdminInvite.update({
    where: { id: invite.id },
    data: { tokenHash, expiresAt },
  });

  const inviteUrl = `${new URL(req.url).origin}/invite/${token}`;

  await (prisma as any).auditLog.create({
    data: {
      tenantId: params.tenantId,
      actorUserId: actor.id,
      action: "school.admin.invite.resend",
      targetType: "SchoolAdminInvite",
      targetId: invite.id,
      afterJson: { email: invite.email, expiresAt },
    },
  });

  const response = NextResponse.redirect(
    new URL(`/god/schools/${params.tenantId}?inviteCreated=1`, req.url)
  );
  response.cookies.set(godInviteCookieName(params.tenantId), inviteUrl, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 300,
    path: `/god/schools/${params.tenantId}`,
  });
  return response;
}
