import { NextResponse } from "next/server";
import { assertCronAuthorized } from "@/lib/cronAuth";
import { prisma } from "@/lib/prisma";

/** Cron: report pending import jobs per tenant (requires CRON_SECRET). */
export async function POST(req: Request) {
  const denied = assertCronAuthorized(req);
  if (denied) return denied;

  const pendingImports = await prisma.importJob.count({ where: { status: "PENDING" } });
  return NextResponse.json({ pendingImports, checkedAt: new Date().toISOString() });
}

/** Vercel Cron always triggers via GET. */
export const GET = POST;
