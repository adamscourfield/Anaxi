import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { FeatureKey, SessionUser, UserRole } from "@/lib/types";

export function requireRole(user: SessionUser, allowedRoles: UserRole[]) {
  if (!allowedRoles.includes(user.role)) throw new Error("FORBIDDEN");
}

/** Assessment write operations (cycles, uploads, lock/unlock). */
export function requireAssessmentWrite(user: SessionUser) {
  requireRole(user, ["ADMIN", "SLT", "SUPER_ADMIN"]);
}

export async function requireFeature(tenantId: string, key: FeatureKey) {
  const feature = await prisma.tenantFeature.findUnique({ where: { tenantId_key: { tenantId, key } } });
  if (!feature?.enabled) throw new Error("FEATURE_DISABLED");
}

/** Server pages: redirect home instead of throwing into the tenant error boundary. */
export async function requireFeatureForPage(tenantId: string, key: FeatureKey) {
  const feature = await prisma.tenantFeature.findUnique({ where: { tenantId_key: { tenantId, key } } });
  if (!feature?.enabled) redirect("/home");
}
