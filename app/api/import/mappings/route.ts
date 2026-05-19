import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { hasPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { withApi } from "@/lib/apiRoute";

/** GET /api/import/mappings?type=STUDENT_SNAPSHOT&headerSignature=... */
export const GET = withApi(async function GET(req: Request) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "STUDENTS_IMPORT");
  if (!hasPermission(user.role, "import:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "STUDENT_SNAPSHOT";
  const headerSignature = searchParams.get("headerSignature") ?? undefined;

  const where: Record<string, unknown> = { tenantId: user.tenantId, type };
  if (headerSignature) where.headerSignature = headerSignature;

  const mappings = await (prisma as any).tenantImportMapping.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json({ mappings });
});
