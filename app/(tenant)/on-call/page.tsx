import Link from "next/link";
import styles from "./page.module.css";
import { getSessionUserOrThrow } from "@/lib/auth";
import { hasOnCallPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getOpenAndAcknowledgedRequests, getResolvedRequests, getTodayActivity } from "@/modules/oncall/service";
import { parseResolvedHistoryRange, resolvedHistoryRangeStart } from "@/modules/oncall/types";
import { OnCallInbox, type InboxRequest, type OnCallStats } from "@/components/oncall/OnCallInbox";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { studentAvatarUrlFor } from "@/lib/avatarUpload";
import { getTenantVocab } from "@/lib/vocab";
import { startOfDayInZone } from "@/modules/oncall/time";

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
  const vocab = await getTenantVocab(user.tenantId);

  const canAcknowledge = hasOnCallPermission(user.role, "oncall:acknowledge");
  const canResolve = hasOnCallPermission(user.role, "oncall:resolve");
  const canViewResolveTime = hasOnCallPermission(user.role, "oncall:view_resolve_time");
  const canCreate = hasOnCallPermission(user.role, "oncall:create");
  // Staff without view_all (e.g. teachers) see the requests they raised, not the whole school's.
  const canViewAll = hasOnCallPermission(user.role, "oncall:view_all");

  const resolvedSearchParams = (await searchParams) ?? {};
  const range = parseResolvedHistoryRange(resolvedSearchParams.range);
  const yearGroup = resolvedSearchParams.yearGroup || undefined;
  const requestedReason = resolvedSearchParams.reason || undefined;

  const now = new Date();
  const todayStart = startOfDayInZone(now);
  const resolvedAfter = resolvedHistoryRangeStart(range, now);
  const scope = canViewAll ? {} : { requesterUserId: user.id };

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
      where: { tenantId: user.tenantId, behaviourReasonCategory: { not: null }, ...scope },
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
  const filters = { yearGroup, reasonCategory: reason, ...scope };

  const [openRequests, resolvedRequests, todayActivity, liveCounts] = await Promise.all([
    getOpenAndAcknowledgedRequests(user.tenantId, filters),
    getResolvedRequests(user.tenantId, resolvedAfter ?? undefined, filters),
    canViewAll ? getTodayActivity(user.tenantId, todayStart) : Promise.resolve([]),
    // Headline counts ignore the list filters, so they always describe the whole school.
    canViewAll
      ? (prisma as any).onCallRequest.groupBy({
          by: ["status"],
          where: { tenantId: user.tenantId, status: { in: ["OPEN", "ACKNOWLEDGED"] } },
          _count: { _all: true },
          _min: { createdAt: true },
        })
      : Promise.resolve([]),
  ]);

  // Prisma's dynamically-shaped integration rows do not retain their full
  // TypeScript shape here. Convert them at the server boundary into the exact
  // client inbox contract, including the authenticated student avatar URL.
  const toInboxRequests = (requests: any[]): InboxRequest[] =>
    requests.map((request) => ({
      id: request.id,
      requestType: request.requestType,
      isEmergency: request.isEmergency,
      location: request.location,
      reason: request.behaviourReasonCategory ?? null,
      status: request.status,
      createdAt: request.createdAt,
      acknowledgedAt: request.acknowledgedAt,
      resolvedAt: canViewResolveTime ? request.resolvedAt : null,
      requester: { fullName: request.requester.fullName },
      student: {
        fullName: request.student.fullName,
        yearGroup: request.student.yearGroup,
        avatarUrl: studentAvatarUrlFor(request.student.id, request.student.avatarUpdatedAt),
      },
      responder: request.responder ? { fullName: request.responder.fullName } : null,
    }));

  type Activity = { status: string; createdAt: Date; acknowledgedAt: Date | null; resolvedAt: Date | null };
  const activity = todayActivity as Activity[];
  const average = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);
  const countFor = (status: string) =>
    (liveCounts as { status: string; _count: { _all: number } }[]).find((c) => c.status === status)?._count._all ?? 0;
  const oldestWaiting = (liveCounts as { status: string; _min: { createdAt: Date | null } }[]).find(
    (c) => c.status === "OPEN",
  )?._min.createdAt;

  const stats: OnCallStats | null = canViewAll
    ? {
        waiting: countFor("OPEN"),
        oldestWaitingAt: oldestWaiting ?? null,
        acknowledged: countFor("ACKNOWLEDGED"),
        raisedToday: activity.length,
        resolvedToday: activity.filter((r) => r.status === "RESOLVED").length,
        // How long people waited for someone to say "I'm on it", today.
        avgTimeToAcknowledgeMs: canViewResolveTime
          ? average(
              activity
                .filter((r) => r.acknowledgedAt)
                .map((r) => new Date(r.acknowledgedAt!).getTime() - new Date(r.createdAt).getTime()),
            )
          : null,
      }
    : null;

  const reportParams = new URLSearchParams({ range });
  if (yearGroup) reportParams.set("yearGroup", yearGroup);
  if (reason) reportParams.set("reason", reason);

  return (
    <div className={`${styles.page} w-full min-w-0 space-y-8`}>
      <PageHeader
        variant="ledger"
        title={vocab.on_calls.singular}
        subtitle={
          canViewAll
            ? "Behaviour and first-aid call-outs across the school, updated live."
            : "The call-outs you've raised and where each one is up to."
        }
        actions={
          <>
            <Button variant="secondary" asChild className="h-10 min-h-0 w-full gap-2 px-5 sm:w-auto">
              <a href={`/api/oncall/report?${reportParams.toString()}`} download>
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
                  <polyline points="7 10 12 15 17 10" strokeLinecap="round" strokeLinejoin="round" />
                  <line x1="12" y1="15" x2="12" y2="3" strokeLinecap="round" />
                </svg>
                Download report
              </a>
            </Button>
            {canCreate ? (
              <Button asChild className="h-10 min-h-0 w-full gap-2 px-5 sm:w-auto">
                <Link href="/on-call/new">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Raise a call-out
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      <OnCallInbox
        openRequests={toInboxRequests(openRequests)}
        resolvedRequests={toInboxRequests(resolvedRequests)}
        resolvedRange={range}
        canAcknowledge={canAcknowledge}
        canResolve={canResolve}
        canViewResolveTime={canViewResolveTime}
        canViewAll={canViewAll}
        stats={stats}
        filtersActive={Boolean(yearGroup || reason)}
        filters={{ range, yearGroup, reason, yearGroupOptions, reasonOptions }}
      />
    </div>
  );
}
