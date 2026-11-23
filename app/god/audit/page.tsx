import styles from "@/app/god/god.module.css";
import Link from "next/link";
import { requireSuperAdminUser } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

const PAGE_SIZE = 30;

export default async function GodAuditPage({
  searchParams,
}: {
  searchParams?: Promise<{ action?: string; tenantId?: string; page?: string }>;
}) {
  await requireSuperAdminUser();
  const resolvedSearchParams = await searchParams;

  const action = resolvedSearchParams?.action?.trim() || "";
  const tenantId = resolvedSearchParams?.tenantId?.trim() || "";
  const page = Math.max(1, Number(resolvedSearchParams?.page ?? "1") || 1);

  const where: any = {
    ...(action ? { action: { contains: action, mode: "insensitive" } } : {}),
    ...(tenantId ? { tenantId } : {}),
  };

  const [rows, total, tenants] = await Promise.all([
    (prisma as any).auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        tenant: { select: { id: true, name: true } },
        actor: { select: { fullName: true, email: true } },
      },
    }),
    (prisma as any).auditLog.count({ where }),
    prisma.tenant.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className={styles.page}>
      <PageHeader variant="ledger" title="Audit log" subtitle="Platform-wide activity across schools." />

      <Card>
        <form className={styles.toolbar} method="get">
          <label>Action<input
            name="action"
            defaultValue={action}
            placeholder="Filter action"
            className="field"
          /></label>
          <label>School<select name="tenantId" defaultValue={tenantId} className="field">
            <option value="">All schools</option>
            {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select></label>
          <input type="hidden" name="page" value="1" />
          <Button type="submit">Apply</Button>
          {action || tenantId ? <Link href="/god/audit">Clear filters</Link> : null}
        </form>
      </Card>

      <div className={styles.tableCard}>
        <table className="text-sm">
          <thead>
            <tr>
              <th>When</th>
              <th>Actor</th>
              <th>Action</th>
              <th>School</th>
              <th>Target</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap tabular-nums text-muted">
                  {new Date(r.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </td>
                <td>{r.actor?.fullName ?? r.actor?.email ?? "—"}</td>
                <td>{r.action}</td>
                <td>{r.tenant?.name ?? "Platform"}</td>
                <td className="break-all text-muted">
                  {r.targetType}
                  {r.targetId ? `:${r.targetId}` : ""}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-10 text-center text-sm text-muted">
                  {action || tenantId ? "No activity matches these filters." : "No activity recorded yet."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className={styles.pager}>
        <span>Page {page} of {totalPages} · {total.toLocaleString("en-GB")} entr{total === 1 ? "y" : "ies"}</span>
        <nav aria-label="Audit log pages">
          <Link
            href={`/god/audit?action=${encodeURIComponent(action)}&tenantId=${encodeURIComponent(tenantId)}&page=${Math.max(1, page - 1)}`}
            aria-disabled={page <= 1}
            tabIndex={page <= 1 ? -1 : undefined}
          >Previous</Link>
          <Link
            href={`/god/audit?action=${encodeURIComponent(action)}&tenantId=${encodeURIComponent(tenantId)}&page=${Math.min(totalPages, page + 1)}`}
            aria-disabled={page >= totalPages}
            tabIndex={page >= totalPages ? -1 : undefined}
          >Next</Link>
        </nav>
      </div>
    </div>
  );
}
