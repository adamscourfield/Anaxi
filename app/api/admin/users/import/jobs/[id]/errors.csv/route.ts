import { requireAdminUser } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { withApi } from "@/lib/apiRoute";

export const GET = withApi(async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const user = await requireAdminUser();

  const job = await (prisma as any).importJob.findFirst({
    where: { id: resolvedParams.id, tenantId: user.tenantId, type: "STAFF_IMPORT" },
  });

  if (!job) {
    return new Response("Not found", { status: 404 });
  }

  const rowErrors: any[] = job.errorReportJson ?? [];

  const header = "rowNumber,Email,FullName,errorCode,message";
  const esc = (v: string | number | undefined) =>
    `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = rowErrors.map((e: any) =>
    [e.rowNumber ?? "", esc(e.email ?? ""), esc(e.fullName ?? ""), esc(e.errorCode ?? ""), esc(e.message ?? "")].join(",")
  );

  const csv = [header, ...lines].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="staff-import-errors-${resolvedParams.id}.csv"`,
    },
  });
});
