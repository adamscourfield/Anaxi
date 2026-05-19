import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { authTenantsBodySchema } from "@/lib/validation/schemas";

export async function POST(request: NextRequest) {
  const limit = await checkRateLimit(`auth-tenants:${clientIp(request)}`, { max: 20, windowMs: 60_000 });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec ?? 60) } },
    );
  }

  let email: string;
  let password: string;
  try {
    ({ email, password } = authTenantsBodySchema.parse(await request.json()));
  } catch {
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
