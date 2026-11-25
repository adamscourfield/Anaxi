import { redirect } from "next/navigation";
import { getSessionUserOrThrow } from "@/lib/auth";
import { hasOnCallPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getTenantVocab } from "@/lib/vocab";
import { OnCallRequestForm } from "@/components/oncall/OnCallRequestForm";
import { REASON_CATEGORIES, LOCATION_SUGGESTIONS } from "@/modules/oncall/types";

// On Call is never gated behind a tenant feature flag -- see on-call/page.tsx.
export default async function OnCallNewPage() {
  const user = await getSessionUserOrThrow();

  if (!hasOnCallPermission(user.role, "oncall:create")) {
    redirect("/on-call");
  }

  const vocab = await getTenantVocab(user.tenantId);
  const students = await (prisma as any).student.findMany({
    where: { tenantId: user.tenantId, status: "ACTIVE" },
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true, upn: true, yearGroup: true },
  });

  // Tenant-customized reasons/locations from Admin → Taxonomies, falling
  // back to the defaults for tenants that haven't set any up.
  const [reasonRows, locationRows] = await Promise.all([
    (prisma as any).onCallReason.findMany({
      where: { tenantId: user.tenantId, active: true },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      select: { label: true },
    }),
    (prisma as any).onCallLocation.findMany({
      where: { tenantId: user.tenantId, active: true },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      select: { label: true },
    }),
  ]);
  const reasons = reasonRows.length > 0
    ? reasonRows.map((r: { label: string }) => r.label)
    : [...REASON_CATEGORIES];
  const locations = locationRows.length > 0
    ? locationRows.map((l: { label: string }) => l.label)
    : [...LOCATION_SUGGESTIONS];

  return (
    <OnCallRequestForm
      students={students}
      reasons={reasons}
      locations={locations}
      inboxLabel={vocab.on_calls.singular}
    />
  );
}
