import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Cron: report pending import jobs per tenant (requires CRON_SECRET). */
export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const pendingImports = await prisma.importJob.count({ where: { status: "PENDING" } });
  return NextResponse.json({ pendingImports, checkedAt: new Date().toISOString() });
}
