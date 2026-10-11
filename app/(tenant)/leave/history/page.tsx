import styles from "./page.module.css";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeatureForPage } from "@/lib/guards";
import { canManageLoa, loaManageableRequesterIds } from "@/lib/loa";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { LeaveHistoryTable } from "./LeaveHistoryTable";
import { loaRequestVisibilityWhere } from "@/modules/leave/leaveQuery";
import { mapLoaRequestToLeaveRow } from "@/modules/leave/leaveRow";
import { updateLoaHrSystemFlag } from "../actions";

export default async function LeaveHistoryPage() {
  const user = await getSessionUserOrThrow();
  await requireFeatureForPage(user.tenantId, "LEAVE");
  const isManager = await canManageLoa(user);
  const manageableIds = await loaManageableRequesterIds(user);
  const canTrackHrSystems = user.role === "HR" || user.role === "ADMIN" || user.role === "SUPER_ADMIN";

  const requests = await prisma.lOARequest.findMany({
    where: loaRequestVisibilityWhere(user.tenantId, user.id, manageableIds),
    include: { reason: true, requester: true },
    orderBy: { updatedAt: "desc" },
    take: 500,
  });

  const rows = requests.map((request) => {
    const row = mapLoaRequestToLeaveRow(request);
    return {
      ...row,
      requestedDates: row.dateRangeLine,
      daysLabel: `${row.days} working day${row.days === 1 ? "" : "s"}`,
      reasonLabel: request.reason?.label ?? request.reasonText ?? "—",
    };
  });

  return (
    <div className={`${styles.page} space-y-8`}>
      <PageHeader variant="ledger"
        title="Leave history"
        subtitle="Browse every leave request and filter by status or keyword."
      />

      <LeaveHistoryTable
        rows={rows}
        isManager={isManager}
        canTrackHrSystems={canTrackHrSystems}
        updateHrSystemFlag={updateLoaHrSystemFlag}
      />
    </div>
  );
}
