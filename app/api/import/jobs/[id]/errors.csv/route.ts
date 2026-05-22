import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { hasPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { withApi } from "@/lib/apiRoute";

export const GET = withApi(async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "STUDENTS_IMPORT");
  if (!hasPermission(user.role, "import:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const job = await (prisma as any).importJob.findFirst({
    where: { id: resolvedParams.id, tenantId: user.tenantId },
    include: { errors: { orderBy: { rowNumber: "asc" } } },
  });

  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const errorReport = job.errorReportJson as any;
  const sampleErrors: any[] = errorReport?.sampleErrors ?? job.errors ?? [];

  const header = "rowNumber,UPN,StudentName,YearGroup,errorCode,message";
  const lines = sampleErrors.map((e: any) => {
    const esc = (v: string | number | undefined) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    return [
      e.rowNumber ?? "",
      esc(e.upn ?? e.field ?? ""),
      esc(e.studentName ?? ""),
      esc(e.yearGroup ?? ""),
      esc(e.errorCode ?? e.field ?? ""),
      esc(e.message ?? ""),
    ].join(",");
  });

  const csv = [header, ...lines].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="import-errors-${resolvedParams.id}.csv"`,
    },
  });
});
