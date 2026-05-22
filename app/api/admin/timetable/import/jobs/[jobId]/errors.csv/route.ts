import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireRole } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { withApi } from "@/lib/apiRoute";

export const GET = withApi(async function GET(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const resolvedParams = await params;
  const user = await getSessionUserOrThrow();
  requireRole(user, ["ADMIN"]);

  const job = await (prisma as any).timetableImportJob.findFirst({
    where: { id: resolvedParams.jobId, tenantId: user.tenantId },
  });

  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const errors: Array<{
    rowNumber: number;
    classCode: string;
    errorCode: string;
    message: string;
  }> = (job.errorReportJson as typeof errors) ?? [];

  const esc = (v: string | number | undefined) =>
    `"${String(v ?? "").replace(/"/g, '""')}"`;

  const header = "rowNumber,ClassCode,errorCode,message";
  const lines = errors.map((e) =>
    [e.rowNumber, esc(e.classCode), esc(e.errorCode), esc(e.message)].join(","),
  );

  const csv = [header, ...lines].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="timetable-errors-${resolvedParams.jobId}.csv"`,
    },
  });
});
