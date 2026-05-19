import { prisma } from "@/lib/prisma";
import { getSessionUserOrThrow } from "@/lib/auth";
import { TenantLayoutClient } from "@/components/tenant-layout-client";
import { getOpenOnCallCount } from "@/lib/oncall/badge";
import { canManageLoa } from "@/lib/loa";
import { hasPermission } from "@/lib/rbac";
import { ALL_FEATURE_KEYS, FeatureKey } from "@/lib/types";

type PrismaWithLOA = typeof prisma & {
  lOARequest: { count: (args: { where: Record<string, unknown> }) => Promise<number> };
};
const db = prisma as PrismaWithLOA;

export default async function TenantLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUserOrThrow();
  const isSuperAdmin = user.role === "SUPER_ADMIN";

  const coachCountPromise =
    user.role === "LEADER"
      ? (prisma as any).coachAssignment.count({ where: { coachUserId: user.id } })
      : Promise.resolve(0);

  const [features, tenant, memberships, coacheeCount] = await Promise.all([
    prisma.tenantFeature.findMany({ where: { tenantId: user.tenantId, enabled: true } }),
    prisma.tenant.findUnique({ where: { id: user.tenantId }, select: { name: true } }),
    isSuperAdmin
      ? prisma.tenant.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } })
      : prisma.user.findMany({
          where: { email: user.email, isActive: true },
          select: { tenantId: true, tenant: { select: { name: true } } },
        }),
    coachCountPromise,
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
  const tenantOptions = isSuperAdmin
    ? (memberships as { id: string; name: string }[]).map((t) => ({
        tenantId: t.id,
        tenantName: t.name,
        isCurrent: t.id === user.tenantId,
      }))
    : (memberships as { tenantId: string; tenant: { name: string } | null }[]).map((m) => ({
        tenantId: m.tenantId,
        tenantName: m.tenant?.name || m.tenantId,
        isCurrent: m.tenantId === user.tenantId,
      }));

  return (
    <TenantLayoutClient
      role={user.role}
      enabledFeatures={isSuperAdmin ? ALL_FEATURE_KEYS : features.map((f) => f.key as FeatureKey)}
      onCallCount={onCallCount}
      leaveCount={leaveCount}
      coacheeCount={coacheeCount}
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
