import { prisma } from "@/lib/prisma";
import { CreateActionInput, UpdateActionStatusInput } from "./types";

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
  const action = await (prisma as any).meetingAction.findFirst({
    where: { id: actionId, tenantId },
  });
  if (!action) throw new Error("action not found");
  if (action.ownerUserId !== userId) throw new Error("only owner can update action status");

  return (prisma as any).meetingAction.update({
    where: { id: actionId },
    data: { status: input.status },
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
    data: { status: "DONE", completedAt: new Date(), completedByUserId: userId },
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

  const trimmedReason = reason.trim();

  return (prisma as any).meetingAction.update({
    where: { id: actionId },
    data: { status: "BLOCKED", blockReason: trimmedReason || null },
    include: ACTION_INCLUDE,
  });
}

export async function getMyActions(tenantId: string, userId: string) {
  const actions = await (prisma as any).meetingAction.findMany({
    where: { tenantId, ownerUserId: userId },
    include: ACTION_INCLUDE,
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
  });

  const now = new Date();
  const grouped: Record<string, typeof actions> = { OPEN: [], BLOCKED: [], DONE: [] };
  for (const action of actions) {
    const key = action.status as string;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push({
      ...action,
      isOverdue: isActionOverdue(action.dueDate),
      daysUntilDue: action.dueDate ? calculateDaysUntilDue(action.dueDate) : null,
    });
  }

  grouped.OPEN.sort((a: any, b: any) => {
    if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return 0;
  });

  return grouped;
}

export async function getOverdueActions(tenantId: string, userId: string) {
  const now = new Date();
  return (prisma as any).meetingAction.count({
    where: {
      tenantId,
      ownerUserId: userId,
      status: "OPEN",
      dueDate: { lt: now },
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

export function calculateDaysUntilDue(dueDate: Date): number {
  const now = new Date();
  const due = new Date(dueDate);
  const diffMs = due.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function isActionOverdue(dueDate: Date | null | undefined): boolean {
  if (!dueDate) return false;
  return calculateDaysUntilDue(dueDate) < 0;
}
