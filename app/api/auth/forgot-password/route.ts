import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail, createPasswordSetToken } from "@/lib/email";
import { getAppUrl } from "@/lib/email/format";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { forgotPasswordBodySchema } from "@/lib/validation/schemas";

const TOKEN_EXPIRY_HOURS = 1;

export async function POST(req: Request) {
  const limit = await checkRateLimit(`forgot-password:${clientIp(req)}`, { max: 10, windowMs: 60_000 });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec ?? 60) } },
    );
  }

  const genericOk = NextResponse.json({ ok: true });

  let parsed: { email: string; tenantId?: string };
  try {
    parsed = forgotPasswordBodySchema.parse(await req.json());
  } catch {
    return genericOk;
  }

  const normalizedEmail = parsed.email;
  const users = await prisma.user.findMany({
    where: {
      email: normalizedEmail,
      isActive: true,
      ...(parsed.tenantId ? { tenantId: parsed.tenantId } : {}),
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
