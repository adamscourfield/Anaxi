import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { SessionUser } from "@/lib/types";
import {
  canApproveLeave,
  type LeaveApprovalGroupRecord,
} from "@/modules/authz";

function isLeaveApprovalSchemaUnavailable(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    (err.code === "P2021" || err.code === "P2010")
  );
}

async function loadLeaveApprovalGroups(tenantId: string): Promise<LeaveApprovalGroupRecord[]> {
  try {
    const groups = await prisma.leaveApprovalGroup.findMany({
      where: { tenantId },
      include: {
        approvers: { select: { approverUserId: true } },
        scopes: { select: { subjectUserId: true } },
      },
    });
    return groups.map((g) => ({
      appliesTo: g.appliesTo,
      approverUserIds: g.approvers.map((a) => a.approverUserId),
      subjectUserIds: g.scopes.map((s) => s.subjectUserId),
    }));
  } catch (err) {
    if (isLeaveApprovalSchemaUnavailable(err)) return [];
    throw err;
  }
}

function canApproveViaGroups(
  approverUserId: string,
  approverRole: SessionUser["role"],
  requesterUserId: string,
  groups: LeaveApprovalGroupRecord[],
): boolean {
  return canApproveLeave(approverUserId, approverRole, { requesterUserId }, groups);
}

function isApproverInAnyGroup(approverUserId: string, groups: LeaveApprovalGroupRecord[]): boolean {
  return groups.some((g) => g.approverUserIds.includes(approverUserId));
}

/** Full tenant visibility (all staff requests). */
async function hasGlobalLoaAccess(user: SessionUser, groups: LeaveApprovalGroupRecord[]): Promise<boolean> {
  if (hasPermission(user.role, "leave:approve_all")) return true;

  const approver = await prisma.user.findFirst({
    where: { id: user.id, tenantId: user.tenantId },
    select: { canApproveAllLoa: true },
  });
  if (approver?.canApproveAllLoa) return true;

  const globalAuthoriser = await prisma.lOAAuthoriser.findUnique({
    where: { tenantId_userId: { tenantId: user.tenantId, userId: user.id } },
  });
  if (globalAuthoriser) return true;

  for (const group of groups) {
    if (group.appliesTo === "ALL_STAFF" && group.approverUserIds.includes(user.id)) {
      return true;
    }
  }

  return false;
}

export async function canManageLoa(user: SessionUser, requesterId?: string) {
  const groups = await loadLeaveApprovalGroups(user.tenantId);

  if (await hasGlobalLoaAccess(user, groups)) return true;

  if (requesterId) {
    const scoped = await prisma.lOAApprovalScope.findUnique({
      where: {
        tenantId_approverId_targetUserId: {
          tenantId: user.tenantId,
          approverId: user.id,
          targetUserId: requesterId,
        },
      },
    });
    if (scoped) return true;

    return canApproveViaGroups(user.id, user.role, requesterId, groups);
  }

  const scopedAny = await prisma.lOAApprovalScope.findFirst({
    where: { tenantId: user.tenantId, approverId: user.id },
  });
  if (scopedAny) return true;

  return isApproverInAnyGroup(user.id, groups);
}

/**
 * Requester user IDs this viewer may manage (excluding self).
 * `null` = all staff in tenant; `[]` = none (requester-only lists).
 */
export async function loaManageableRequesterIds(user: SessionUser): Promise<string[] | null> {
  const groups = await loadLeaveApprovalGroups(user.tenantId);

  if (await hasGlobalLoaAccess(user, groups)) return null;

  const ids = new Set<string>();

  for (const scope of await prisma.lOAApprovalScope.findMany({
    where: { tenantId: user.tenantId, approverId: user.id },
    select: { targetUserId: true },
  })) {
    ids.add(scope.targetUserId);
  }

  for (const group of groups) {
    if (!group.approverUserIds.includes(user.id)) continue;
    if (group.appliesTo === "ALL_STAFF") return null;
    for (const subjectId of group.subjectUserIds) {
      ids.add(subjectId);
    }
  }

  return Array.from(ids);
}

/** Distinct approver emails to notify when a new request is submitted. */
export async function loaApproverEmailsForRequest(
  tenantId: string,
  requesterUserId: string,
): Promise<string[]> {
  const groups = await loadLeaveApprovalGroups(tenantId);
  const approverIds = new Set<string>();

  const globalAuthorisers = await prisma.lOAAuthoriser.findMany({
    where: { tenantId },
    select: { userId: true },
  });
  for (const row of globalAuthorisers) approverIds.add(row.userId);

  const scopedApprovers = await prisma.lOAApprovalScope.findMany({
    where: { tenantId, targetUserId: requesterUserId },
    select: { approverId: true },
  });
  for (const row of scopedApprovers) approverIds.add(row.approverId);

  const allStaffApprovers = await prisma.user.findMany({
    where: { tenantId, canApproveAllLoa: true, isActive: true },
    select: { id: true },
  });
  for (const row of allStaffApprovers) approverIds.add(row.id);

  for (const group of groups) {
    if (!group.approverUserIds.length) continue;
    if (group.appliesTo === "ALL_STAFF") {
      for (const id of group.approverUserIds) approverIds.add(id);
      continue;
    }
    if (group.subjectUserIds.includes(requesterUserId)) {
      for (const id of group.approverUserIds) approverIds.add(id);
    }
  }

  const roleApprovers = await prisma.user.findMany({
    where: {
      tenantId,
      isActive: true,
      role: { in: ["ADMIN", "SUPER_ADMIN", "SLT"] },
    },
    select: { id: true, email: true },
  });
  for (const row of roleApprovers) approverIds.add(row.id);

  approverIds.delete(requesterUserId);

  if (approverIds.size === 0) return [];

  const users = await prisma.user.findMany({
    where: { tenantId, id: { in: Array.from(approverIds) }, isActive: true },
    select: { id: true, email: true },
  });
  return [...new Set(users.map((u) => u.email).filter(Boolean))];
}

/** Approver emails and ids for leave notification preferences. */
export async function loaApproversForRequest(
  tenantId: string,
  requesterUserId: string,
): Promise<Array<{ id: string; email: string; fullName: string }>> {
  const emails = await loaApproverEmailsForRequest(tenantId, requesterUserId);
  if (emails.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { tenantId, email: { in: emails }, isActive: true },
    select: { id: true, email: true, fullName: true },
  });
  return users;
}
