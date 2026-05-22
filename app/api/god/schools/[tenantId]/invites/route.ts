import { createHash, randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminUser } from "@/lib/admin";
import { assertCsrfFromForm } from "@/lib/csrf";
import { sendSchoolAdminInviteEmail } from "@/lib/email";
import { godInviteCookieName } from "@/lib/godInviteCookie";
import { withApi } from "@/lib/apiRoute";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export const POST = withApi(async function POST(req: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  const resolvedParams = await params;
  const actor = await requireSuperAdminUser();
  const form = await req.formData();
  try {
    await assertCsrfFromForm(form);
  } catch {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const fullName = String(form.get("fullName") ?? "").trim();

  if (!email || !fullName) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const tenant = await prisma.tenant.findUnique({ where: { id: resolvedParams.tenantId } });
  if (!tenant) return NextResponse.json({ error: "School not found" }, { status: 404 });

  const token = randomBytes(24).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

  await (prisma as any).schoolAdminInvite.create({
    data: {
      tenantId: tenant.id,
      email,
      fullName,
      tokenHash,
      expiresAt,
      invitedByUserId: actor.id,
    },
  });

  const inviteUrl = `${new URL(req.url).origin}/invite/${token}`;

  await sendSchoolAdminInviteEmail({
    to: email,
    fullName,
    tenantId: tenant.id,
    tenantName: tenant.name,
    inviteToken: token,
  });

  await (prisma as any).auditLog.create({
    data: {
      tenantId: tenant.id,
      actorUserId: actor.id,
      action: "school.admin.invite.create",
      targetType: "SchoolAdminInvite",
      afterJson: { email, fullName, expiresAt },
    },
  });

  const response = NextResponse.redirect(
    new URL(`/god/schools/${tenant.id}?inviteCreated=1`, req.url)
  );
  response.cookies.set(godInviteCookieName(tenant.id), inviteUrl, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 300,
    path: `/god/schools/${tenant.id}`,
  });
  return response;
});
