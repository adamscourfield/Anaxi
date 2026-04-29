import Link from "next/link";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { getTenantVocab } from "@/lib/vocab";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { PillVariant, StatusPill } from "@/components/ui/status-pill";

const FEED_STATUS_PILL: Record<string, PillVariant> = {
  SENT: "warning",
  ACKNOWLEDGED: "neutral",
  RESOLVED: "success",
  CANCELLED: "error",
};

export default async function OnCallFeedPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ON_CALL");
  const vocab = await getTenantVocab(user.tenantId);

  const status = searchParams.status || "";
  const yearGroup = searchParams.yearGroup || "";
  const emailError = searchParams.emailError || "";
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const requests = await (prisma as any).onCallRequest.findMany({
    where: {
      tenantId: user.tenantId,
      createdAt: { gte: start },
      ...(status ? { status } : {}),
      ...(yearGroup ? { student: { yearGroup } } : {}),
    },
    include: { student: true, requester: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const todayLabel = start.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  return (
    <div className="w-full min-w-0 space-y-5">
      <PageHeader
        title={`Today's ${vocab.on_calls.plural} feed`}
        subtitle={`${requests.length} request${requests.length === 1 ? "" : "s"} · ${todayLabel}`}
      />

      {emailError ? (
        <Card className="border-error/40 bg-error/10 p-3">
          <p className="text-sm font-medium text-error">Email dispatch warning: {emailError}</p>
        </Card>
      ) : null}

      <div className="filter-panel">
        <form className="filter-bar" method="get">
          <label className="flex min-w-0 flex-col gap-1.5 sm:min-w-[200px]">
            <span className="filter-field-label">Status</span>
            <select
              name="status"
              defaultValue={status}
              className="field field-filter-trigger min-w-0 !py-2.5 !text-sm"
            >
              <option value="">All statuses</option>
              <option value="SENT">SENT</option>
              <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
              <option value="RESOLVED">RESOLVED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </label>

          <label className="flex min-w-0 flex-col gap-1.5 sm:min-w-[160px]">
            <span className="filter-field-label">Year group</span>
            <input
              name="yearGroup"
              defaultValue={yearGroup}
              placeholder="e.g. 10"
              className="field field-filter-trigger !py-2.5 !text-sm"
            />
          </label>

          <div className="filter-actions filter-actions--inline !ml-0 w-full sm:w-auto lg:ml-0">
            <button type="submit" className="btn-filter-primary">
              Apply
            </button>
            <Link href="/on-call/feed" className="btn-filter-secondary text-center no-underline">
              Reset
            </Link>
          </div>
        </form>
      </div>

      {requests.length === 0 ? (
        <EmptyState
          title="No feed entries for today"
          description={`No ${vocab.on_calls.plural.toLowerCase()} match your current filters.`}
          action={
            <Link href="/on-call/feed">
              <Button type="button" variant="secondary">Clear filters</Button>
            </Link>
          }
        />
      ) : (
        <div className="table-shell">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="table-head-row">
                  <th className="px-5 py-3.5">Time</th>
                  <th className="px-4 py-3.5">Student</th>
                  <th className="px-4 py-3.5 text-center">Category</th>
                  <th className="px-4 py-3.5">Location</th>
                  <th className="px-4 py-3.5">Reason</th>
                  <th className="px-4 py-3.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {(requests as any[]).map((r: any) => (
                  <tr key={r.id} className="table-row calm-transition">
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <Link className="link-accent font-medium underline-offset-2" href={`/on-call/${r.id}`}>
                        {new Date(r.createdAt).toLocaleTimeString()}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5">
                      {r.student?.fullName} ({r.student?.yearGroup || "-"})
                    </td>
                    <td className="px-4 py-3.5 text-center">{r.category}</td>
                    <td className="px-4 py-3.5">{r.location || "-"}</td>
                    <td className="px-4 py-3.5">{r.behaviourReasonCategory || "-"}</td>
                    <td className="px-4 py-3.5 text-center">
                      <StatusPill variant={FEED_STATUS_PILL[r.status] ?? "neutral"}>{r.status}</StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
