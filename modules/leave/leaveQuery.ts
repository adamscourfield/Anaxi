import type { Prisma } from "@prisma/client";

/**
 * Build tenant-scoped visibility for LOA list/calendar queries.
 * `manageableRequesterIds === null` → approver may see all staff requests in the tenant.
 * Otherwise → own requests plus listed requester IDs.
 */
export function loaRequestVisibilityWhere(
  tenantId: string,
  viewerUserId: string,
  manageableRequesterIds: string[] | null,
): Prisma.LOARequestWhereInput {
  if (manageableRequesterIds === null) {
    return { tenantId };
  }
  if (manageableRequesterIds.length === 0) {
    return { tenantId, requesterId: viewerUserId };
  }
  return {
    tenantId,
    OR: [{ requesterId: viewerUserId }, { requesterId: { in: manageableRequesterIds } }],
  };
}

/** Pending items this viewer may act on (excludes own requests). */
export function loaPendingApprovalWhere(
  tenantId: string,
  viewerUserId: string,
  manageableRequesterIds: string[] | null,
): Prisma.LOARequestWhereInput {
  const pending = { status: "PENDING" as const, requesterId: { not: viewerUserId } };
  if (manageableRequesterIds === null) {
    return { tenantId, ...pending };
  }
  if (manageableRequesterIds.length === 0) {
    return { tenantId, ...pending, requesterId: { in: [] } };
  }
  return {
    tenantId,
    ...pending,
    requesterId: { in: manageableRequesterIds },
  };
}
