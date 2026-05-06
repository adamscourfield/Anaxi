import { prisma } from "@/lib/prisma";

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
  viewerUserId: string;
  manager: boolean;
  monthKey: string;
}): Promise<LeaveCalendarRequestJson[]> {
  const parsed = parseMonthKey(params.monthKey);
  if (!parsed) return [];

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

  const requests = await (prisma as any).lOARequest.findMany({
    where: params.manager
      ? { tenantId: params.tenantId }
      : { tenantId: params.tenantId, requesterId: params.viewerUserId },
    include: { reason: true, requester: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (requests as any[])
    .filter((r) => {
      const rStart = new Date(r.startDate);
      const rEnd = new Date(r.endDate);
      return rStart <= calEnd && rEnd >= calStart;
    })
    .map((r) => ({
      id: r.id as string,
      startDate: new Date(r.startDate).toISOString(),
      endDate: new Date(r.endDate).toISOString(),
      status: r.status as string,
      reason: r.reason ? { label: String(r.reason.label) } : null,
      requester: r.requester ? { fullName: String(r.requester.fullName ?? "") } : null,
    }));
}
