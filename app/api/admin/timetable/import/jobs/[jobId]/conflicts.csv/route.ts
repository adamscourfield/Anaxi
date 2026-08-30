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
  requireRole(user, ["ADMIN", "SUPER_ADMIN"]);

  const job = await (prisma as any).timetableImportJob.findFirst({
    where: { id: resolvedParams.jobId, tenantId: user.tenantId },
  });

  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const conflicts: Array<{
    rowNumber: number;
    classCode: string;
    teacherEmail: string;
    conflictCode: string;
    message: string;
  }> = (job.conflictsJson as typeof conflicts) ?? [];

  const esc = (v: string | number | undefined) =>
    `"${String(v ?? "").replace(/"/g, '""')}"`;

  const header = "rowNumber,ClassCode,TeacherEmail,conflictCode,message";
  const lines = conflicts.map((c) =>
    [c.rowNumber, esc(c.classCode), esc(c.teacherEmail), esc(c.conflictCode), esc(c.message)].join(","),
  );

  const csv = [header, ...lines].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="timetable-conflicts-${resolvedParams.jobId}.csv"`,
    },
  });
});
