import { prisma } from "@/lib/prisma";
import { loaManageableRequesterIds } from "@/lib/loa";
import { loaRequestVisibilityWhere } from "@/modules/leave/leaveQuery";
import type { SessionUser } from "@/lib/types";

/** Minimal fields for leave calendar cells (JSON-serialisable). */
export type LeaveCalendarRequestJson = {
  id: string;
  startDate: string;
  endDate: string;
  status: string;
  reason: { label: string } | null;
  requester: { fullName: string } | null;
};

export function parseMonthKey(monthKey: string): { y: number; m: number } | null {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) return null;
  const [y, m] = monthKey.split("-").map(Number);
  if (m < 1 || m > 12) return null;
  return { y, m };
}

export async function fetchLeaveCalendarMonthRequests(params: {
  tenantId: string;
  viewer: SessionUser;
  monthKey: string;
}): Promise<LeaveCalendarRequestJson[]> {
  const parsed = parseMonthKey(params.monthKey);
  if (!parsed) return [];

  const manageableIds = await loaManageableRequesterIds(params.viewer);
  const calendarDate = new Date(parsed.y, parsed.m - 1, 1);
  const calStart = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1);
  const calEnd = new Date(
    calendarDate.getFullYear(),
    calendarDate.getMonth() + 1,
    0,
    23,
    59,
    59,
  );

  const requests = await prisma.lOARequest.findMany({
    where: loaRequestVisibilityWhere(params.tenantId, params.viewer.id, manageableIds),
    include: { reason: true, requester: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  return requests
    .filter((r) => {
      const rStart = new Date(r.startDate);
      const rEnd = new Date(r.endDate);
      return rStart <= calEnd && rEnd >= calStart;
    })
    .map((r) => ({
      id: r.id,
      startDate: new Date(r.startDate).toISOString(),
      endDate: new Date(r.endDate).toISOString(),
      status: r.status,
      reason: r.reason ? { label: String(r.reason.label) } : null,
      requester: r.requester ? { fullName: String(r.requester.fullName ?? "") } : null,
    }));
}
