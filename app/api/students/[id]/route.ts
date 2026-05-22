import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { hasPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { calculateStudentDeltas } from "@/modules/students/service";
import { withApi } from "@/lib/apiRoute";
import { canAccessStudentRecord } from "@/modules/students/access";

export const GET = withApi(async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "STUDENTS");
  if (!hasPermission(user.role, "students:read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const student = await (prisma as any).student.findFirst({
    where: { id: resolvedParams.id, tenantId: user.tenantId },
    include: {
      snapshots: { orderBy: { snapshotDate: "desc" }, take: 10 },
      changeFlags: { where: { resolvedAt: null }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!student) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canAccessStudentRecord(user, student.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const snaps = (student.snapshots ?? []).map((s: any) => ({
    ...s,
    attendancePct: Number(s.attendancePct),
  }));

  const trends = snaps.length > 0
    ? calculateStudentDeltas(snaps[0], snaps[1] ?? null)
    : null;

  return NextResponse.json({ ...student, trends });
});
