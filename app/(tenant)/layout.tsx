import { prisma } from "@/lib/prisma";
import { getSessionUserOrThrow } from "@/lib/auth";
import { TenantLayoutClient } from "@/components/tenant-layout-client";
import { getOpenOnCallCount } from "@/lib/oncall/badge";
import { canManageLoa } from "@/lib/loa";
import { hasPermission } from "@/lib/rbac";
import { FeatureKey } from "@/lib/types";

type PrismaWithLOA = typeof prisma & {
  lOARequest: { count: (args: { where: Record<string, unknown> }) => Promise<number> };
};
const db = prisma as PrismaWithLOA;

export default async function TenantLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUserOrThrow();
  const [features, tenant, otherMemberships] = await Promise.all([
    prisma.tenantFeature.findMany({ where: { tenantId: user.tenantId, enabled: true } }),
    prisma.tenant.findUnique({ where: { id: user.tenantId }, select: { name: true } }),
    prisma.user.findMany({
      where: { email: user.email, isActive: true },
      select: { tenantId: true, tenant: { select: { name: true } } },
    }),
  ]);

  const canSeeOnCallBadge = hasPermission(user.role, "oncall:view_all");
  const isApprover = await canManageLoa(user);

  const [onCallCount, leaveCount] = await Promise.all([
    canSeeOnCallBadge ? getOpenOnCallCount(user.tenantId) : Promise.resolve(0),
    isApprover
      ? db.lOARequest.count({ where: { tenantId: user.tenantId, status: "PENDING", requesterId: { not: user.id } } })
      : Promise.resolve(0),
  ]);

  const tenantName = tenant?.name || "School";
  const tenantOptions = otherMemberships.map((m) => ({
    tenantId: m.tenantId,
    tenantName: m.tenant?.name || m.tenantId,
    isCurrent: m.tenantId === user.tenantId,
  }));

  return (
    <TenantLayoutClient
      role={user.role}
      enabledFeatures={features.map((f) => f.key as FeatureKey)}
      onCallCount={onCallCount}
      leaveCount={leaveCount}
      tenantName={tenantName}
      tenantOptions={tenantOptions}
      userFullName={user.fullName}
      userEmail={user.email}
      userRole={user.role}
    >
      {children}
    </TenantLayoutClient>
  );
}
