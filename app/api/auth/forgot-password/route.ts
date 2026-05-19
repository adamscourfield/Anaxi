import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import crypto from "crypto";

const TOKEN_EXPIRY_HOURS = 1;

export async function POST(req: Request) {
  const { email, tenantId } = await req.json().catch(() => ({}));

  // Always return success to avoid leaking whether an email is registered
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
    select: { id: true, fullName: true, email: true },
  });

  if (users.length === 0) return genericOk;
  if (users.length > 1) {
    // Ambiguous without tenantId — do not reset the wrong account
    return genericOk;
  }

  const user = users[0];

  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  });

  const appUrl = process.env.NEXTAUTH_URL || process.env.APP_URL || "http://localhost:3000";
  const resetUrl = `${appUrl}/login/reset-password?token=${rawToken}`;

  await sendEmail({
    to: user.email,
    subject: "Reset your Anaxi password",
    message: [
      `Hi ${user.fullName},`,
      "",
      "You requested a password reset for your Anaxi account.",
      "",
      `Click the link below to set a new password (valid for ${TOKEN_EXPIRY_HOURS} hour):`,
      "",
      resetUrl,
      "",
      "If you did not request this, you can safely ignore this email.",
      "",
      "– The Anaxi Team",
    ].join("\n"),
  });

  return genericOk;
}
