import Link from "next/link";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { hasOnCallPermission } from "@/lib/rbac";
import { getRequestsByStatus } from "@/modules/oncall/service";
import { OnCallInbox } from "@/components/oncall/OnCallInbox";
import { Button } from "@/components/ui/button";

export default async function OnCallHomePage() {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ON_CALL");

  const canAcknowledge = hasOnCallPermission(user.role, "oncall:acknowledge");
  const canResolve = hasOnCallPermission(user.role, "oncall:resolve");

  const { data: allRequests } = await getRequestsByStatus(user.tenantId, undefined, 200, 0);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const openRequests = allRequests.filter(
    (r: { status: string }) => r.status === "OPEN" || r.status === "ACKNOWLEDGED"
  );

  const resolvedToday = allRequests.filter(
    (r: { status: string; resolvedAt?: Date | string | null }) =>
      r.status === "RESOLVED" &&
      r.resolvedAt &&
      new Date(r.resolvedAt) >= todayStart
  );

  const todayRequests = allRequests.filter(
    (r: { createdAt: Date | string }) => new Date(r.createdAt) >= todayStart
  );

  const totalLogsToday = todayRequests.length;

  const resolvedWithDuration = resolvedToday.filter(
    (r: { resolvedAt?: Date | string | null; createdAt: Date | string }) =>
      r.resolvedAt
  );
  const avgResponseMs =
    resolvedWithDuration.length > 0
      ? resolvedWithDuration.reduce(
          (sum: number, r: { resolvedAt?: Date | string | null; createdAt: Date | string }) => {
            const resolved = r.resolvedAt ? new Date(r.resolvedAt).getTime() : 0;
            return sum + (resolved - new Date(r.createdAt).getTime());
          },
          0
        ) / resolvedWithDuration.length
      : 0;

  const todayResolved = todayRequests.filter(
    (r: { status: string }) => r.status === "RESOLVED"
  ).length;
  const todayClosed = todayRequests.filter(
    (r: { status: string }) =>
      r.status === "RESOLVED" || r.status === "CANCELLED"
  ).length;
  const resolutionRate =
    todayClosed > 0 ? Math.round((todayResolved / todayClosed) * 100) : 0;

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <h1 className="min-w-0 text-pretty text-[28px] font-bold leading-tight tracking-[-0.03em] text-text">
          On Call
        </h1>
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
          <Button variant="secondary" className="w-full sm:w-auto">
            Download report
          </Button>
          <Link href="/on-call/new" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto">New request</Button>
          </Link>
        </div>
      </div>

      <hr className="border-border/60" />

      <OnCallInbox
        openRequests={openRequests}
        resolvedRequests={resolvedToday}
        canAcknowledge={canAcknowledge}
        canResolve={canResolve}
        totalLogsToday={totalLogsToday}
        avgResponseMs={avgResponseMs}
        resolutionRate={resolutionRate}
      />
    </div>
  );
}
