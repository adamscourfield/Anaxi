import Link from "next/link";
import { requireSuperAdminUser } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, InteractiveCard } from "@/components/ui/card";
import { MetaText } from "@/components/ui/typography";

export default async function GodDashboardPage() {
  await requireSuperAdminUser();

  const [schools, admins] = await Promise.all([
    prisma.tenant.findMany({
      orderBy: { name: "asc" },
      include: {
        features: { where: { enabled: true }, select: { key: true } },
        users: { where: { role: "ADMIN" }, select: { id: true } },
      },
    }),
    prisma.user.count({ where: { role: "SUPER_ADMIN", isActive: true } }),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <PageHeader
        variant="ledger"
        eyebrow="Platform"
        title="God Mode"
        subtitle="Platform-level school provisioning and module control."
        actions={
          <>
            <Link href="/god/audit">
              <Button variant="secondary">Audit log</Button>
            </Link>
            <Link href="/god/schools/new">
              <Button>+ Create school</Button>
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <div className="text-xs text-muted">Schools</div>
          <div className="text-2xl font-semibold">{schools.length}</div>
        </Card>
        <Card>
          <div className="text-xs text-muted">Super admins</div>
          <div className="text-2xl font-semibold">{admins}</div>
        </Card>
        <Card>
          <div className="text-xs text-muted">Active schools</div>
          <div className="text-2xl font-semibold">{schools.filter((s) => s.status === "ACTIVE").length}</div>
        </Card>
      </div>

      <div className="space-y-3">
        {schools.map((school) => (
          <Link key={school.id} href={`/god/schools/${school.id}`}>
            <InteractiveCard className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{school.name}</div>
                  <MetaText>
                    {school.slug ?? "no-slug"} · {school.status}
                  </MetaText>
                </div>
                <div className="text-right text-xs text-muted">
                  <div>{school.users.length} admin(s)</div>
                  <div>{school.features.length} module(s) enabled</div>
                </div>
              </div>
            </InteractiveCard>
          </Link>
        ))}
      </div>
    </div>
  );
}
