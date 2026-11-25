import { prisma } from "@/lib/prisma";
import { startOfDayInZone } from "@/modules/oncall/time";
import { CreateActionInput, UpdateActionStatusInput } from "./types";
import { daysUntilDue, isPastDue } from "./dates";

const VALID_STATUSES = new Set(["OPEN", "DONE", "BLOCKED"]);
const MAX_REASON = 500;
/** Done actions shown on My Actions; older ones stay on their meeting. */
export const RECENT_DONE_LIMIT = 30;

const ACTION_INCLUDE = {
  owner: { select: { id: true, fullName: true, email: true } },
  createdBy: { select: { id: true, fullName: true, email: true } },
  completedBy: { select: { id: true, fullName: true } },
  meeting: { select: { id: true, title: true } },
};

export async function createAction(
  tenantId: string,
  meetingId: string,
  createdByUserId: string,
  input: CreateActionInput
) {
  if (!input.description) throw new Error("description required");
  if (!input.ownerUserId) throw new Error("ownerUserId required");

  const meeting = await (prisma as any).meeting.findFirst({ where: { id: meetingId, tenantId } });
  if (!meeting) throw new Error("meeting not found");

  const owner = await (prisma as any).user.findFirst({
    where: { id: input.ownerUserId, tenantId, isActive: true },
  });
  if (!owner) throw new Error("owner user not found");

  return (prisma as any).meetingAction.create({
    data: {
      tenantId,
      meetingId,
      description: input.description,
      ownerUserId: input.ownerUserId,
      dueDate: input.dueDate ?? null,
      status: "OPEN",
      createdByUserId,
    },
    include: ACTION_INCLUDE,
  });
}

export async function getActionDetail(tenantId: string, actionId: string) {
  const action = await (prisma as any).meetingAction.findFirst({
    where: { id: actionId, tenantId },
    include: ACTION_INCLUDE,
  });
  if (!action) throw new Error("action not found");
  return action;
}

export async function updateActionStatus(
  tenantId: string,
  actionId: string,
  userId: string,
  input: UpdateActionStatusInput
) {
  if (!VALID_STATUSES.has(input.status)) throw new Error("Invalid status");
  const action = await (prisma as any).meetingAction.findFirst({
    where: { id: actionId, tenantId },
  });
  if (!action) throw new Error("action not found");
  if (action.ownerUserId !== userId) throw new Error("only owner can update action status");

  if (input.status === "DONE") return completeAction(tenantId, actionId, userId);
  if (input.status === "BLOCKED") return blockAction(tenantId, actionId, userId, input.notes ?? "");

  // Reopening clears whatever made it blocked or done.
  return (prisma as any).meetingAction.update({
    where: { id: actionId },
    data: { status: "OPEN", blockReason: null, completedAt: null, completedByUserId: null },
    include: ACTION_INCLUDE,
  });
}

export async function completeAction(tenantId: string, actionId: string, userId: string) {
  const action = await (prisma as any).meetingAction.findFirst({
    where: { id: actionId, tenantId },
  });
  if (!action) throw new Error("action not found");
  if (action.ownerUserId !== userId) throw new Error("only owner can complete action");

  return (prisma as any).meetingAction.update({
    where: { id: actionId },
    data: { status: "DONE", completedAt: new Date(), completedByUserId: userId, blockReason: null },
    include: ACTION_INCLUDE,
  });
}

export async function blockAction(
  tenantId: string,
  actionId: string,
  userId: string,
  reason: string
) {
  const action = await (prisma as any).meetingAction.findFirst({
    where: { id: actionId, tenantId },
  });
  if (!action) throw new Error("action not found");
  if (action.ownerUserId !== userId) throw new Error("only owner can block action");

  const trimmedReason = reason.trim().slice(0, MAX_REASON);
  if (!trimmedReason) throw new Error("reason required");

  return (prisma as any).meetingAction.update({
    where: { id: actionId },
    data: { status: "BLOCKED", blockReason: trimmedReason, completedAt: null, completedByUserId: null },
    include: ACTION_INCLUDE,
  });
}

export async function getMyActions(tenantId: string, userId: string, now: Date = new Date()) {
  const [active, done, doneTotal] = await Promise.all([
    (prisma as any).meetingAction.findMany({
      where: { tenantId, ownerUserId: userId, status: { in: ["OPEN", "BLOCKED"] } },
      include: ACTION_INCLUDE,
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    }),
    (prisma as any).meetingAction.findMany({
      where: { tenantId, ownerUserId: userId, status: "DONE" },
      include: ACTION_INCLUDE,
      orderBy: [{ completedAt: { sort: "desc", nulls: "last" } }, { updatedAt: "desc" }],
      take: RECENT_DONE_LIMIT,
    }),
    (prisma as any).meetingAction.count({ where: { tenantId, ownerUserId: userId, status: "DONE" } }),
  ]);

  const grouped: Record<"OPEN" | "BLOCKED" | "DONE", any[]> & { doneTotal: number } = {
    OPEN: [],
    BLOCKED: [],
    DONE: [],
    doneTotal: doneTotal ?? 0,
  };
  for (const action of [...(active ?? []), ...(done ?? [])]) {
    const key = action.status as "OPEN" | "BLOCKED" | "DONE";
    if (!grouped[key]) continue;
    grouped[key].push({
      ...action,
      isOverdue: key !== "DONE" && isPastDue(action.dueDate, now),
      daysUntilDue: action.dueDate ? daysUntilDue(action.dueDate, now) : null,
    });
  }
  return grouped;
}

/** Open or blocked actions whose due day (UK) has passed. Matches the Meetings summary. */
export async function getOverdueActions(tenantId: string, userId: string, now: Date = new Date()) {
  return (prisma as any).meetingAction.count({
    where: {
      tenantId,
      ownerUserId: userId,
      status: { in: ["OPEN", "BLOCKED"] },
      dueDate: { lt: startOfDayInZone(now) },
    },
  });
}

export async function getActionsByOwner(tenantId: string, ownerUserId: string) {
  return (prisma as any).meetingAction.findMany({
    where: { tenantId, ownerUserId },
    include: ACTION_INCLUDE,
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
  });
}

/** Kept for older callers; see ./dates for the UK calendar-day rules. */
export function calculateDaysUntilDue(dueDate: Date): number {
  return daysUntilDue(dueDate);
}

export function isActionOverdue(dueDate: Date | null | undefined): boolean {
  return isPastDue(dueDate);
}
