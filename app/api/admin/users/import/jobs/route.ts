import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { withApi } from "@/lib/apiRoute";

export const GET = withApi(async function GET() {
  const user = await requireAdminUser();

  const jobs = await (prisma as any).importJob.findMany({
    where: { tenantId: user.tenantId, type: "STAFF_IMPORT" },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ jobs });
});
