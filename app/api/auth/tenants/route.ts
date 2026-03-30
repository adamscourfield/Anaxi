import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.toLowerCase().trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
  }

  const candidates = await prisma.user.findMany({
    where: { email, isActive: true },
    include: { tenant: { select: { id: true, name: true } } },
  });

  const matches: typeof candidates = [];
  for (const candidate of candidates) {
    if (!candidate.passwordHash) continue;
    const ok = await bcrypt.compare(password, candidate.passwordHash);
    if (ok) matches.push(candidate);
  }

  if (matches.length === 0) {
    // Return the same shape as a success so we don't reveal whether the email exists.
    return NextResponse.json({ tenants: [] });
  }

  return NextResponse.json({
    tenants: matches.map((m) => ({
      id: m.tenantId,
      name: m.tenant?.name ?? m.tenantId,
    })),
  });
}
