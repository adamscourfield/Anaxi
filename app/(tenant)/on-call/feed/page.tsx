import Link from "next/link";
import styles from "./page.module.css";
import { getSessionUserOrThrow } from "@/lib/auth";
import { hasOnCallPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getTenantVocab } from "@/lib/vocab";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { OnCallFeed, type FeedRow } from "@/components/oncall/OnCallFeed";
import { startOfDayInZone, SCHOOL_TIME_ZONE } from "@/modules/oncall/time";

const STATUSES = ["OPEN", "ACKNOWLEDGED", "RESOLVED", "CANCELLED"] as const;

/** Every call-out raised today, newest first: the running log for the school day. */
export default async function OnCallFeedPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | undefined>>;
}) {
  const user = await getSessionUserOrThrow();
  const vocab = await getTenantVocab(user.tenantId);
  const resolvedSearchParams = (await searchParams) ?? {};
  // Staff without view_all (e.g. teachers) see the requests they raised, not the whole school's.
  const canViewAll = hasOnCallPermission(user.role, "oncall:view_all");

  const requestedStatus = resolvedSearchParams.status || "";
  const status = (STATUSES as readonly string[]).includes(requestedStatus) ? requestedStatus : "";
  const yearGroup = resolvedSearchParams.yearGroup || "";
  const now = new Date();
  const start = startOfDayInZone(now);
  const scope = { tenantId: user.tenantId, createdAt: { gte: start }, ...(canViewAll ? {} : { requesterUserId: user.id }) };

  const [requests, statusCounts, yearGroupRows] = await Promise.all([
    (prisma as any).onCallRequest.findMany({
      where: { ...scope, ...(status ? { status } : {}), ...(yearGroup ? { student: { yearGroup } } : {}) },
      select: {
        id: true,
        status: true,
        requestType: true,
        isEmergency: true,
        location: true,
        behaviourReasonCategory: true,
        createdAt: true,
        student: { select: { fullName: true, yearGroup: true } },
        requester: { select: { fullName: true } },
        responder: { select: { fullName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
    // Counts per status for the chips, within the year-group filter.
    (prisma as any).onCallRequest.groupBy({
      by: ["status"],
      where: { ...scope, ...(yearGroup ? { student: { yearGroup } } : {}) },
      _count: { _all: true },
    }),
    (prisma as any).student.findMany({
      where: { tenantId: user.tenantId, status: "ACTIVE" },
      select: { yearGroup: true },
      distinct: ["yearGroup"],
    }),
  ]);

  const rows: FeedRow[] = (requests as any[]).map((r) => ({
    id: r.id,
    status: r.status,
    requestType: r.requestType,
    isEmergency: r.isEmergency,
    location: r.location,
    reason: r.behaviourReasonCategory ?? null,
    createdAt: r.createdAt.toISOString(),
    student: { fullName: r.student?.fullName ?? "Unknown student", yearGroup: r.student?.yearGroup ?? null },
    requester: r.requester?.fullName ?? "",
    responder: r.responder?.fullName ?? null,
  }));

  const counts = Object.fromEntries(
    (statusCounts as { status: string; _count: { _all: number } }[]).map((c) => [c.status, c._count._all]),
  ) as Record<string, number>;

  const yearGroupOptions = (yearGroupRows as { yearGroup: string | null }[])
    .map((s) => s.yearGroup)
    .filter((yg): yg is string => Boolean(yg))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const todayLabel = now.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: SCHOOL_TIME_ZONE,
  });

  return (
    <div className={`${styles.page} w-full min-w-0 space-y-8`}>
      <PageHeader
        variant="ledger"
        title="Today's log"
        subtitle={`${canViewAll ? "Every call-out" : "Every call-out you've"} raised on ${todayLabel}, newest first.`}
        actions={
          <Button variant="secondary" asChild className="h-10 min-h-0 px-5">
            <Link href="/on-call">Back to {vocab.on_calls.singular}</Link>
          </Button>
        }
      />
      <OnCallFeed
        rows={rows}
        status={status}
        yearGroup={yearGroup}
        counts={counts}
        yearGroupOptions={yearGroupOptions}
      />
    </div>
  );
}
