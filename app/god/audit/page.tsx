import Link from "next/link";
import { requireSuperAdminUser } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { MetaText } from "@/components/ui/typography";

const PAGE_SIZE = 30;

export default async function GodAuditPage({
  searchParams,
}: {
  searchParams?: { action?: string; tenantId?: string; page?: string };
}) {
  await requireSuperAdminUser();

  const action = searchParams?.action?.trim() || "";
  const tenantId = searchParams?.tenantId?.trim() || "";
  const page = Math.max(1, Number(searchParams?.page ?? "1") || 1);

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
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <PageHeader variant="ledger" eyebrow="Platform" title="God audit log" subtitle="Platform-wide activity across schools." />

      <Card>
        <form className="grid gap-2 sm:grid-cols-4" method="get">
          <input
            name="action"
            defaultValue={action}
            placeholder="Filter action"
            className="field"
          />
          <select name="tenantId" defaultValue={tenantId} className="field">
            <option value="">All schools</option>
            {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <input type="hidden" name="page" value="1" />
          <Button type="submit">Apply</Button>
        </form>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="table-shell border-0 rounded-none shadow-none">
          <div className="overflow-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="table-head-row">
                  <th className="px-5 py-3">When</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">School</th>
                  <th className="px-4 py-3">Target</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r: any) => (
                  <tr key={r.id} className="table-row calm-transition">
                    <td className="px-5 py-3.5 whitespace-nowrap tabular-nums text-muted">
                      {new Date(r.createdAt).toLocaleString("en-GB")}
                    </td>
                    <td className="px-4 py-3.5">{r.actor?.fullName ?? r.actor?.email ?? "—"}</td>
                    <td className="px-4 py-3.5">{r.action}</td>
                    <td className="px-4 py-3.5">{r.tenant?.name ?? "platform"}</td>
                    <td className="px-4 py-3.5">
                      {r.targetType}
                      {r.targetId ? `:${r.targetId}` : ""}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-sm text-muted">
                      No audit rows.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      <div className="flex items-center justify-between text-sm">
        <MetaText>Page {page} of {totalPages}</MetaText>
        <div className="flex gap-2">
          <Link
            href={`/god/audit?action=${encodeURIComponent(action)}&tenantId=${encodeURIComponent(tenantId)}&page=${Math.max(1, page - 1)}`}
            className={`calm-transition rounded-lg border border-border px-3 py-1.5 text-sm ${page <= 1 ? "pointer-events-none opacity-50" : "hover:border-accent/30 hover:bg-[var(--accent-tint)]"}`}
          >Prev</Link>
          <Link
            href={`/god/audit?action=${encodeURIComponent(action)}&tenantId=${encodeURIComponent(tenantId)}&page=${Math.min(totalPages, page + 1)}`}
            className={`calm-transition rounded-lg border border-border px-3 py-1.5 text-sm ${page >= totalPages ? "pointer-events-none opacity-50" : "hover:border-accent/30 hover:bg-[var(--accent-tint)]"}`}
          >Next</Link>
        </div>
      </div>
    </div>
  );
}
