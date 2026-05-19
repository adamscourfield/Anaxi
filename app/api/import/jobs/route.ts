import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { hasPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "STUDENTS_IMPORT");
  if (!hasPermission(user.role, "import:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const job = await (prisma as any).importJob.create({
    data: {
      tenantId: user.tenantId,
      type: "STUDENTS_SNAPSHOT",
      status: "PENDING",
      uploadedBy: user.id,
      fileName: "pending-upload.csv",
      rowCount: 0,
    },
  });

  return NextResponse.json({ jobId: job.id, status: job.status });
}

export async function GET(req: Request) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "STUDENTS_IMPORT");
  if (!hasPermission(user.role, "import:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page = Number(searchParams.get("page") ?? 1);
  const pageSize = 20;
  const skip = (page - 1) * pageSize;

  const jobs = await (prisma as any).importJob.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { createdAt: "desc" },
    take: pageSize,
    skip,
    include: { errors: { take: 3 } },
  });

  const total = await (prisma as any).importJob.count({ where: { tenantId: user.tenantId } });

  return NextResponse.json({ jobs, total, page, pageSize });
}
