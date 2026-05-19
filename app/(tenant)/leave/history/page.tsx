import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { canManageLoa, loaManageableRequesterIds } from "@/lib/loa";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { LeaveHistoryTable } from "./LeaveHistoryTable";
import { loaRequestVisibilityWhere } from "@/modules/leave/leaveQuery";
import { mapLoaRequestToLeaveRow } from "@/modules/leave/leaveRow";

export default async function LeaveHistoryPage() {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "LEAVE");
  const isManager = await canManageLoa(user);
  const manageableIds = await loaManageableRequesterIds(user);

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
    <div className="space-y-6">
      <PageHeader variant="ledger"
        eyebrow="Leave of Absence"
        title="Ledger History"
        subtitle="Browse every leave request and filter by status or keyword."
      />

      <LeaveHistoryTable rows={rows} isManager={isManager} />
    </div>
  );
}
