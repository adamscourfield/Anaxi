import Link from "next/link";
import { getSessionUserOrThrow } from "@/lib/auth";
import { hasOnCallPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getOpenAndAcknowledgedRequests, getResolvedRequests, getTodayActivity } from "@/modules/oncall/service";
import { parseResolvedHistoryRange, resolvedHistoryRangeStart } from "@/modules/oncall/types";
import { OnCallInbox } from "@/components/oncall/OnCallInbox";
import { OnCallFilters } from "@/components/oncall/OnCallFilters";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";

// On Call is a safety-critical feature: unlike other modules, it is never
// gated behind a tenant feature flag -- every school can always log and
// track on-call requests. Whether staff receive emails about them is a
// separate, per-user preference (see modules/oncall/notifications.ts).
export default async function OnCallHomePage({
  searchParams,
}: {
  searchParams?: Promise<{ range?: string; yearGroup?: string; reason?: string }>;
}) {
  const user = await getSessionUserOrThrow();

  const canAcknowledge = hasOnCallPermission(user.role, "oncall:acknowledge");
  const canResolve = hasOnCallPermission(user.role, "oncall:resolve");
  const canViewResolveTime = hasOnCallPermission(user.role, "oncall:view_resolve_time");

  const resolvedSearchParams = (await searchParams) ?? {};
  const range = parseResolvedHistoryRange(resolvedSearchParams.range);
  const yearGroup = resolvedSearchParams.yearGroup || undefined;
  const requestedReason = resolvedSearchParams.reason || undefined;

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const resolvedAfter = resolvedHistoryRangeStart(range, now);

  // Reason options reflect this tenant's actual behaviour taxonomy (custom
  // reasons configured under Admin -> Taxonomies, not just the built-in
  // defaults), so the filter always matches what's really on the records.
  const [studentYearGroups, reasonRows] = await Promise.all([
    (prisma as any).student.findMany({
      where: { tenantId: user.tenantId, status: "ACTIVE" },
      select: { yearGroup: true },
      distinct: ["yearGroup"],
    }),
    (prisma as any).onCallRequest.findMany({
      where: { tenantId: user.tenantId, behaviourReasonCategory: { not: null } },
      select: { behaviourReasonCategory: true },
      distinct: ["behaviourReasonCategory"],
    }),
  ]);

  const yearGroupOptions = (studentYearGroups as { yearGroup: string | null }[])
    .map((s) => s.yearGroup)
    .filter((yg): yg is string => Boolean(yg))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const reasonOptions = (reasonRows as { behaviourReasonCategory: string | null }[])
    .map((r) => r.behaviourReasonCategory)
    .filter((r): r is string => Boolean(r))
    .sort((a, b) => a.localeCompare(b));

  const reason = requestedReason && reasonOptions.includes(requestedReason) ? requestedReason : undefined;
  const filters = { yearGroup, reasonCategory: reason };

  const [openRequests, resolvedRequests, todayActivity] = await Promise.all([
    getOpenAndAcknowledgedRequests(user.tenantId, filters),
    getResolvedRequests(user.tenantId, resolvedAfter ?? undefined, filters),
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
              <a
                href={`/api/oncall/report?range=${range}${yearGroup ? `&yearGroup=${encodeURIComponent(yearGroup)}` : ""}${reason ? `&reason=${encodeURIComponent(reason)}` : ""}`}
                download
              >
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

      <OnCallFilters
        range={range}
        yearGroup={yearGroup}
        reason={reason}
        yearGroupOptions={yearGroupOptions}
        reasonOptions={reasonOptions}
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
