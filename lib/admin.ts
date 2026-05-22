import { getSessionUserOrThrow } from "@/lib/auth";
import { requireRole } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/types";

export async function requireAdminUser() {
  const user = await getSessionUserOrThrow();
  requireRole(user, ["ADMIN", "SUPER_ADMIN"]);
  return user;
}

export async function requireSuperAdminUser() {
  const user = await getSessionUserOrThrow();
  requireRole(user, ["SUPER_ADMIN"]);
  return user;
}

/** Tenant admins must not create or promote users to platform super admin. */
export function assertAdminCannotAssignSuperAdminRole(actor: SessionUser, role: string) {
  if (actor.role === "ADMIN" && role === "SUPER_ADMIN") throw new Error("FORBIDDEN");
}

/**
 * Tenant admins cannot mutate users who are platform super admins.
 * Platform super admins may manage everyone in the tenant.
 */
export async function assertAdminCanMutateUser(actor: SessionUser, targetUserId: string, tenantId: string) {
  if (actor.role !== "ADMIN") return;
  const target = await prisma.user.findFirst({
    where: { id: targetUserId, tenantId },
    select: { role: true },
  });
  if (target?.role === "SUPER_ADMIN") throw new Error("FORBIDDEN");
}

export async function assertUsersBelongToTenant(tenantId: string, userIds: string[]) {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueIds.length === 0) return;

  const count = await prisma.user.count({
    where: { tenantId, id: { in: uniqueIds } },
  });
  if (count !== uniqueIds.length) throw new Error("FORBIDDEN");
}
