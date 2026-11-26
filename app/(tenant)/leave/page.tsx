import Link from "next/link";
import styles from "./page.module.css";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeatureForPage } from "@/lib/guards";
import { canManageLoa, loaManageableRequesterIds } from "@/lib/loa";
import { prisma } from "@/lib/prisma";
import { LeaveTable } from "./LeaveTable";
import { LeaveCalendarGrid } from "./LeaveCalendarGrid";
import { LeaveCreatedToast } from "@/components/leave/leave-created-toast";
import { Button } from "@/components/ui/button";
import { fetchLeaveCalendarMonthRequests } from "@/modules/leave/leaveCalendarMonthData";
import { loaRequestVisibilityWhere } from "@/modules/leave/leaveQuery";
import { mapLoaRequestToLeaveRow } from "@/modules/leave/leaveRow";

export default async function LeavePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getSessionUserOrThrow();
  await requireFeatureForPage(user.tenantId, "LEAVE");

  const params = (await searchParams) ?? {};
  const view = String(params.view || "list");
  const isCalendar = view === "calendar";
  const monthParam = String(params.month || "");

  const isApprover = await canManageLoa(user);
  const manageableIds = await loaManageableRequesterIds(user);

  let calendarDate = new Date();
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split("-").map(Number);
    calendarDate = new Date(y, m - 1, 1);
  }

  // Pending and decided are fetched separately so an old pending request is never pushed out by newer ones.
  const visibility = loaRequestVisibilityWhere(user.tenantId, user.id, manageableIds);
  const [pending, decided] = await Promise.all([
    prisma.lOARequest.findMany({
      where: { AND: [visibility, { status: "PENDING" }] },
      include: { reason: true, requester: true },
      orderBy: { startDate: "asc" },
      take: 100,
    }),
    prisma.lOARequest.findMany({
      where: { AND: [visibility, { status: { not: "PENDING" } }] },
      include: { reason: true, requester: true },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
  ]);
  const pendingRows = pending.map(mapLoaRequestToLeaveRow);
  const completedRows = decided.map(mapLoaRequestToLeaveRow);

  const hasAnyListRows = pendingRows.length > 0 || completedRows.length > 0;
  const monthQuery = `${calendarDate.getFullYear()}-${String(calendarDate.getMonth() + 1).padStart(2, "0")}`;

  const calendarRequests = isCalendar
    ? await fetchLeaveCalendarMonthRequests({
        tenantId: user.tenantId,
        viewer: user,
        monthKey: monthQuery,
      })
    : [];

  return (
    <div className={`${styles.page} space-y-8`}>
      <Suspense fallback={null}>
        <LeaveCreatedToast />
      </Suspense>
      <PageHeader variant="ledger"
        title="Leave of absence"
        subtitle={isApprover ? "Requests from your team, and your own." : "Request time off and see where your requests have got to."}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <nav className={styles.segmented} aria-label="Leave view">
              <Link href="/leave?view=list" aria-current={!isCalendar ? "page" : undefined} className={styles.segLink}>
                List
              </Link>
              <Link href="/leave?view=calendar" aria-current={isCalendar ? "page" : undefined} className={styles.segLink}>
                Calendar
              </Link>
            </nav>

            <Button asChild className="h-10 min-h-0 px-5">
              <Link href="/leave/request">Request leave</Link>
            </Button>
          </div>
        }
      />

      {isCalendar ? (
        <LeaveCalendarGrid
          initialMonthKey={monthQuery}
          initialRequests={calendarRequests}
          basePath="leave"
        />
      ) : !hasAnyListRows ? (
        <div className={styles.empty}>
          <p className="text-[15px] font-semibold text-[#1c1c1e]">No leave requests yet</p>
          <p className="mt-1 text-[13px]">Requests you send, and their decisions, will show here.</p>
        </div>
      ) : (
        <LeaveTable pendingRows={pendingRows} completedRows={completedRows} isManager={isApprover} viewerId={user.id} />
      )}
    </div>
  );
}
