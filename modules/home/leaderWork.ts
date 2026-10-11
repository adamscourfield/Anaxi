import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/types";

/** Personal work only; leadership access must not turn this into other users' task lists. */
export async function fetchLeaderWork(user: SessionUser, enabled: boolean, now = new Date()) {
  if (!enabled) return null;
  const today = now.toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  const results = await Promise.allSettled([
    prisma.meetingAction.findMany({
      where: { tenantId: user.tenantId, ownerUserId: user.id, status: { in: ["OPEN", "BLOCKED"] } },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
      take: 4, select: { id: true, description: true, dueDate: true, status: true },
    }),
    prisma.meetingAction.count({ where: { tenantId: user.tenantId, ownerUserId: user.id, status: { in: ["OPEN", "BLOCKED"] } } }),
    prisma.meeting.findMany({
      where: { tenantId: user.tenantId, status: { not: "CANCELLED" }, startDateTime: { gte: new Date(now.getTime() - 86400000), lt: new Date(now.getTime() + 86400000) },
        OR: [{ createdByUserId: user.id }, { attendees: { some: { userId: user.id } } }] },
      orderBy: { startDateTime: "asc" }, select: { id: true, title: true, startDateTime: true, location: true },
    }),
  ]);
  return {
    actions: results[0].status === "fulfilled" ? results[0].value : null,
    actionCount: results[1].status === "fulfilled" ? results[1].value : null,
    meetings: results[2].status === "fulfilled" ? results[2].value.filter(m => m.startDateTime.toLocaleDateString("en-CA", { timeZone: "Europe/London" }) === today) : null,
  };
}
