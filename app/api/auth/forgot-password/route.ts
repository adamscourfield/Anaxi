import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail, createPasswordSetToken } from "@/lib/email";
import { getAppUrl } from "@/lib/email/format";

const TOKEN_EXPIRY_HOURS = 1;

export async function POST(req: Request) {
  const { email, tenantId } = await req.json().catch(() => ({}));

  const genericOk = NextResponse.json({ ok: true });

  if (!email || typeof email !== "string") return genericOk;

  const normalizedEmail = email.toLowerCase().trim();
  const users = await prisma.user.findMany({
    where: {
      email: normalizedEmail,
      isActive: true,
      ...(typeof tenantId === "string" && tenantId.trim()
        ? { tenantId: tenantId.trim() }
        : {}),
    },
    select: { id: true, fullName: true, email: true, tenantId: true },
  });

  if (users.length === 0) return genericOk;
  if (users.length > 1) return genericOk;

  const user = users[0];

  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });

  const rawToken = await createPasswordSetToken(user.id, TOKEN_EXPIRY_HOURS);
  const resetUrl = `${getAppUrl()}/login/reset-password?token=${rawToken}`;

  await sendPasswordResetEmail({
    to: user.email,
    fullName: user.fullName,
    resetUrl,
    tenantId: user.tenantId,
  });

  return genericOk;
}
