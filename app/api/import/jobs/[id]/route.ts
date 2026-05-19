import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { hasPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { withApi } from "@/lib/apiRoute";

export const GET = withApi(async function GET(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "STUDENTS_IMPORT");
  if (!hasPermission(user.role, "import:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const job = await (prisma as any).importJob.findFirst({
    where: { id: params.id, tenantId: user.tenantId },
    include: { errors: { orderBy: { rowNumber: "asc" } } },
  });

  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(job);
});
