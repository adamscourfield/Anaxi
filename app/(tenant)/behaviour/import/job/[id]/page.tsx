import { notFound } from "next/navigation";
import Link from "next/link";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { hasPermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { H2, MetaText } from "@/components/ui/typography";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";

export default async function ImportJobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "STUDENTS_IMPORT");
  if (!hasPermission(user.role, "import:write")) redirect("/tenant");
  const resolvedParams = await params;

  const job = await (prisma as any).importJob.findFirst({
    where: { id: resolvedParams.id, tenantId: user.tenantId },
    include: { errors: { orderBy: { rowNumber: "asc" } } },
  });
  if (!job) notFound();

  const isRunning = ["PENDING", "PROCESSING", "RUNNING"].includes(job.status);
  const isFinished = ["COMPLETED", "SUCCESS", "FAILED"].includes(job.status);

  const statusVariant = (job.status === "COMPLETED" || job.status === "SUCCESS")
    ? "success" as const
    : job.status === "FAILED"
    ? "error" as const
    : "neutral" as const;

  return (
    <div className="space-y-4">
      <PageHeader
        variant="ledger"
        eyebrow={<>Students › Behaviour import</>}
        title="Import job report"
        subtitle={job.fileName ? `File: ${job.fileName}` : undefined}
        meta={<StatusPill variant={statusVariant}>{job.status}</StatusPill>}
      />

      <Card className="space-y-2">
        <div className="flex justify-between text-sm">
          <MetaText>Status</MetaText>
          <StatusPill variant={statusVariant}>{job.status}</StatusPill>
        </div>
        <div className="flex justify-between text-sm">
          <MetaText>Type</MetaText>
          <span>{job.type}</span>
        </div>
        <div className="flex justify-between text-sm">
          <MetaText>File</MetaText>
          <span>{job.fileName || "–"}</span>
        </div>
        <div className="flex justify-between text-sm">
          <MetaText>Rows Processed</MetaText>
          <span>{job.rowCount}</span>
        </div>
        <div className="flex justify-between text-sm">
          <MetaText>Created</MetaText>
          <span>{new Date(job.createdAt).toLocaleString()}</span>
        </div>
      </Card>

      {isRunning && (
        <Card>
          <MetaText>Import in progress…</MetaText>
        </Card>
      )}

      {isFinished && job.errors?.length > 0 && (
        <Card className="space-y-2 overflow-hidden p-0">
          <div className="p-4 pb-0">
            <H2 className="text-base">Errors ({job.errors.length})</H2>
          </div>
          <div className="table-shell border-0 rounded-none shadow-none">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="table-head-row">
                    <th className="px-5 py-3">Row</th>
                    <th className="px-4 py-3">Field</th>
                    <th className="px-4 py-3">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {(job.errors as any[]).map((err: any) => (
                    <tr key={err.id} className="table-row calm-transition">
                      <td className="px-5 py-3 tabular-nums text-muted">{err.rowNumber}</td>
                      <td className="px-4 py-3">{err.field}</td>
                      <td className="px-4 py-3">{err.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}

      {isFinished && (!job.errors || job.errors.length === 0) && (
        <Card className="border-success/30 bg-[var(--pill-success-bg)]">
          <p className="text-sm text-success">Import completed with no errors.</p>
        </Card>
      )}
    </div>
  );
}
