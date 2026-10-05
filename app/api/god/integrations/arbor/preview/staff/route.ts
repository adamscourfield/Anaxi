import { NextResponse } from "next/server";
import { arborConnectionWhere } from "@/lib/integrations/arbor/connectionScope";
import { requireSuperAdminUser } from "@/lib/admin";
import { withApi } from "@/lib/apiRoute";
import { assertCsrfFromForm } from "@/lib/csrf";
import { decryptCredentials } from "@/lib/integrationSecrets";
import { ArborClient } from "@/lib/integrations/arbor/client";
import { compareArborStaff } from "@/lib/integrations/arbor/staffComparison";
import type { ArborCredentials } from "@/lib/integrations/arbor/types";
import { PLATFORM_TENANT_ID } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

export const POST = withApi(async function POST(req: Request) {
  const actor = await requireSuperAdminUser();
  const form = await req.formData();
  try { await assertCsrfFromForm(form); } catch { return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }); }
  const db = prisma as any;
  const integration = await db.sharedIntegration.findFirst({ where: arborConnectionWhere(req), include: { schools: { where: { enabled: true }, include: { tenant: { include: { tenantSettings: true } } } } } });
  if (!integration?.credentialsCiphertext || integration.status !== "CONNECTED") return NextResponse.redirect(new URL("/god/integrations/arbor?staff=not-connected", req.url));
  try {
    const targets: { PRIMARY?: string; SECONDARY?: string } = {};
    for (const school of integration.schools) {
      if (school.tenant.tenantSettings?.schoolType === "PRIMARY") targets.PRIMARY = school.tenantId;
      if (school.tenant.tenantSettings?.schoolType === "SECONDARY") targets.SECONDARY = school.tenantId;
    }
    const [staff, users] = await Promise.all([
      new ArborClient(decryptCredentials<ArborCredentials>(integration.credentialsCiphertext)).listAllStaff(),
      db.user.findMany({ where: { tenantId: { in: Object.values(targets) } }, select: { tenantId: true, fullName: true, externalId: true, dataSource: true, isActive: true } }),
    ]);
    const comparison = compareArborStaff(staff, targets, users);
    await db.auditLog.create({ data: { tenantId: PLATFORM_TENANT_ID, actorUserId: actor.id, action: "integration.arbor.staff_previewed", targetType: "SharedIntegration", targetId: integration.id, afterJson: comparison } });
    const url = new URL("/god/integrations/arbor", req.url);
    url.searchParams.set("staff", "success");
    for (const [key, value] of Object.entries(comparison)) url.searchParams.set(key, String(value));
    return NextResponse.redirect(url);
  } catch { return NextResponse.redirect(new URL("/god/integrations/arbor?staff=failed", req.url)); }
});
