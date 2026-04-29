import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default async function AdminImportsPage() {
  const user = await requireAdminUser();
  const jobs = await (prisma as any).importJob.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { createdAt: "desc" },
    include: { errors: { take: 5, orderBy: { createdAt: "desc" } } },
    take: 100
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Import Jobs" subtitle="Recent import status, row counts, and top errors." />
      <Card className="overflow-hidden p-0">
        {jobs.length === 0 ? (
          <div className="p-4"><EmptyState title="No import jobs yet" description="Imported files will appear here with status and errors." /></div>
        ) : (
          <div className="table-shell border-0 rounded-none shadow-none">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="table-head-row text-left">
                  <th className="px-5 py-3.5">Type</th>
                  <th className="px-4 py-3.5 text-center">Status</th>
                  <th className="px-4 py-3.5">File</th>
                  <th className="px-4 py-3.5 text-center">Rows</th>
                  <th className="px-5 py-3.5">Error summary</th>
                </tr>
              </thead>
              <tbody>
                {(jobs as any[]).map((j: any) => (
                  <tr key={j.id} className="table-row align-top calm-transition">
                    <td className="px-5 py-3">{j.type}</td>
                    <td className="px-4 py-3 text-center">{j.status}</td>
                    <td className="px-4 py-3">{j.fileName}</td>
                    <td className="px-4 py-3 text-center">{j.rowCount}</td>
                    <td className="px-5 py-3">
                      <div>{j.errorSummary || "-"}</div>
                      {j.errors?.length ? (
                        <ul className="list-disc pl-5 text-xs text-muted">
                          {j.errors.map((e: any) => (
                            <li key={e.id}>
                              row {e.rowNumber} {e.field}: {e.message}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
