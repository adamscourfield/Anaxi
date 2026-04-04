import Link from "next/link";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { hasOnCallPermission } from "@/lib/rbac";
import { getRequestsByStatus } from "@/modules/oncall/service";
import { OnCallInbox } from "@/components/oncall/OnCallInbox";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";

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
      <PageHeader
        title="On Call"
        actions={
          <>
            <Button variant="secondary" className="w-full sm:w-auto">
              Download report
            </Button>
            <Link href="/on-call/new" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto">New request</Button>
            </Link>
          </>
        }
      />

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
