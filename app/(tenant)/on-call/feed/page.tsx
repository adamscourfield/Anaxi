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

      <Card>
        <form className="flex flex-wrap items-center gap-2" method="get">
          <select
            name="status"
            defaultValue={status}
            className="rounded-md border border-border bg-bg/60 px-3 py-2 text-sm text-text"
          >
            <option value="">All statuses</option>
            <option value="SENT">SENT</option>
            <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
            <option value="RESOLVED">RESOLVED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>

          <input
            name="yearGroup"
            defaultValue={yearGroup}
            placeholder="Year group"
            className="rounded-md border border-border bg-bg/60 px-3 py-2 text-sm text-text"
          />

          <Button type="submit">Apply</Button>
          <Link href="/on-call/feed">
            <Button type="button" variant="secondary">Reset</Button>
          </Link>
        </form>
      </Card>

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
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border/80 text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-3 py-2 font-medium">Time</th>
                <th className="px-3 py-2 font-medium">Student</th>
                <th className="px-3 py-2 text-center font-medium">Category</th>
                <th className="px-3 py-2 font-medium">Location</th>
                <th className="px-3 py-2 font-medium">Reason</th>
                <th className="px-3 py-2 text-center font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {(requests as any[]).map((r: any) => (
                <tr key={r.id} className="border-b border-border/70 last:border-0 hover:bg-bg/40">
                  <td className="px-3 py-2">
                    <Link className="font-medium text-primaryBtn underline-offset-2 hover:underline" href={`/on-call/${r.id}`}>
                      {new Date(r.createdAt).toLocaleTimeString()}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    {r.student?.fullName} ({r.student?.yearGroup || "-"})
                  </td>
                  <td className="px-3 py-2 text-center">{r.category}</td>
                  <td className="px-3 py-2">{r.location || "-"}</td>
                  <td className="px-3 py-2">{r.behaviourReasonCategory || "-"}</td>
                  <td className="px-3 py-2 text-center">
                    <StatusPill variant={FEED_STATUS_PILL[r.status] ?? "neutral"}>{r.status}</StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
