import styles from "../imports/page.module.css";
import { StatusPill } from "@/components/ui/status-pill";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin";
import { Card } from "@/components/ui/card";
import { AdminPageChrome } from "@/components/ui/admin-page-chrome";
import { EmptyState } from "@/components/ui/empty-state";

export async function ImportsAdminPanel() {
  const user = await requireAdminUser();
  const jobs = await (prisma as any).importJob.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { createdAt: "desc" },
    include: { errors: { take: 5, orderBy: { createdAt: "desc" } } },
    take: 100
  });

  return (
    <div className={`${styles.page} space-y-8`}>
      <AdminPageChrome area="Imports" title="Import jobs" subtitle="Track status, row counts and validation issues for the latest 100 imports." />
      <section className={styles.stats} aria-label="Import summary">
        {[{label:"Recent imports", value:jobs.length}, {label:"In progress", value:jobs.filter((j: any) => ["PENDING", "PROCESSING", "RUNNING"].includes(j.status)).length}, {label:"Failed", value:jobs.filter((j: any) => j.status === "FAILED").length}].map(stat => <div key={stat.label}><span>{stat.label}</span><strong>{stat.value}</strong></div>)}
      </section>

      <Card className="overflow-hidden p-0">
        {jobs.length === 0 ? (
          <div className="p-4"><EmptyState title="No import jobs yet" description="Imported files will appear here with status and errors." /></div>
        ) : (
          <div className="table-shell overflow-x-auto border-0 rounded-none shadow-none">
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
                    <td className="px-4 py-3 text-center"><StatusPill size="sm" variant={j.status === "FAILED" ? "error" : j.status === "COMPLETED" ? "success" : "neutral"}>{j.status.replaceAll("_", " ")}</StatusPill></td>
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

