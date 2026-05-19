import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { hasPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { withApi } from "@/lib/apiRoute";

export const GET = withApi(async function GET(req: Request) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "STUDENTS");
  if (!hasPermission(user.role, "students:read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const yearGroup = searchParams.get("yearGroup") ?? undefined;
  const send = searchParams.get("send");
  const pp = searchParams.get("pp");
  const status = searchParams.get("status") ?? "ACTIVE";
  const page = Number(searchParams.get("page") ?? 1);
  const pageSize = 50;
  const skip = (page - 1) * pageSize;

  const where: any = {
    tenantId: user.tenantId,
    ...(yearGroup ? { yearGroup } : {}),
    ...(send !== null ? { sendFlag: send === "true" } : {}),
    ...(pp !== null ? { ppFlag: pp === "true" } : {}),
    ...(status ? { status } : {}),
  };

  const students = await (prisma as any).student.findMany({
    where,
    orderBy: { fullName: "asc" },
    take: pageSize,
    skip,
    include: {
      snapshots: { orderBy: { snapshotDate: "desc" }, take: 2 },
      changeFlags: { where: { resolvedAt: null } },
    },
  });

  const total = await (prisma as any).student.count({ where });

  return NextResponse.json({ students, total, page, pageSize });
});
