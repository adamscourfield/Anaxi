import Link from "next/link";
import { getSessionUserOrThrow } from "@/lib/auth";
import { hasOnCallPermission } from "@/lib/rbac";
import { getOpenAndAcknowledgedRequests, getResolvedRequests, getTodayActivity } from "@/modules/oncall/service";
import { parseResolvedHistoryRange, resolvedHistoryRangeStart } from "@/modules/oncall/types";
import { OnCallInbox } from "@/components/oncall/OnCallInbox";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";

// On Call is a safety-critical feature: unlike other modules, it is never
// gated behind a tenant feature flag -- every school can always log and
// track on-call requests. Whether staff receive emails about them is a
// separate, per-user preference (see modules/oncall/notifications.ts).
export default async function OnCallHomePage({
  searchParams,
}: {
  searchParams?: Promise<{ range?: string }>;
}) {
  const user = await getSessionUserOrThrow();

  const canAcknowledge = hasOnCallPermission(user.role, "oncall:acknowledge");
  const canResolve = hasOnCallPermission(user.role, "oncall:resolve");
  const canViewResolveTime = hasOnCallPermission(user.role, "oncall:view_resolve_time");

  const resolvedSearchParams = (await searchParams) ?? {};
  const range = parseResolvedHistoryRange(resolvedSearchParams.range);

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const resolvedAfter = resolvedHistoryRangeStart(range, now);

  const [openRequests, resolvedRequests, todayActivity] = await Promise.all([
    getOpenAndAcknowledgedRequests(user.tenantId),
    getResolvedRequests(user.tenantId, resolvedAfter ?? undefined),
    getTodayActivity(user.tenantId, todayStart),
  ]);

  const totalLogsToday = todayActivity.length;

  const resolvedTodayWithDuration = todayActivity.filter(
    (r: { status: string; resolvedAt?: Date | string | null }) => r.status === "RESOLVED" && r.resolvedAt
  );
  const avgResponseMs =
    resolvedTodayWithDuration.length > 0
      ? resolvedTodayWithDuration.reduce(
          (sum: number, r: { resolvedAt?: Date | string | null; createdAt: Date | string }) => {
            const resolved = r.resolvedAt ? new Date(r.resolvedAt).getTime() : 0;
            return sum + (resolved - new Date(r.createdAt).getTime());
          },
          0
        ) / resolvedTodayWithDuration.length
      : 0;

  const todayResolved = todayActivity.filter(
    (r: { status: string }) => r.status === "RESOLVED"
  ).length;
  const todayClosed = todayActivity.filter(
    (r: { status: string }) =>
      r.status === "RESOLVED" || r.status === "CANCELLED"
  ).length;
  const resolutionRate =
    todayClosed > 0 ? Math.round((todayResolved / todayClosed) * 100) : 0;

  return (
    <div className="w-full min-w-0 space-y-8">
      <PageHeader variant="ledger"
        title="On Call"
        actions={
          <>
            <Button variant="secondary" asChild className="h-10 min-h-0 w-full gap-2 rounded-md px-6 sm:w-auto">
              <a href={`/api/oncall/report?range=${range}`} download>
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
                  <polyline points="7 10 12 15 17 10" strokeLinecap="round" strokeLinejoin="round" />
                  <line x1="12" y1="15" x2="12" y2="3" strokeLinecap="round" />
                </svg>
                Download report
              </a>
            </Button>
            <Link href="/on-call/new" className="w-full sm:w-auto">
              <Button className="h-10 min-h-0 w-full gap-2 rounded-md px-6 shadow-md sm:w-auto">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <path d="M12 5v14M5 12h14" />
                </svg>
                New request
              </Button>
            </Link>
          </>
        }
      />

      <OnCallInbox
        openRequests={openRequests}
        resolvedRequests={resolvedRequests}
        resolvedRange={range}
        canAcknowledge={canAcknowledge}
        canResolve={canResolve}
        canViewResolveTime={canViewResolveTime}
        totalLogsToday={totalLogsToday}
        avgResponseMs={avgResponseMs}
        resolutionRate={resolutionRate}
      />
    </div>
  );
}
