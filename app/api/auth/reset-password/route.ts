import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { withApi } from "@/lib/apiRoute";
import { resetPasswordBodySchema } from "@/lib/validation/schemas";

export const POST = withApi(async function POST(req: Request) {
  let token: string;
  let password: string;
  try {
    ({ token, password } = resetPasswordBodySchema.parse(await req.json()));
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const passwordHash = await bcrypt.hash(password, 12);

  const updated = await prisma.$transaction(async (tx) => {
    const record = await tx.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true } } },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      return null;
    }

    const marked = await tx.passwordResetToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    if (marked.count !== 1) return null;

    await tx.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    });

    return record;
  });

  if (!updated) {
    return NextResponse.json(
      { error: "This reset link is invalid or has expired. Please request a new one." },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
});
