import { NextResponse } from "next/server";
import { requireSuperAdminUser } from "@/lib/admin";
import { withApi } from "@/lib/apiRoute";
import { assertCsrfFromForm } from "@/lib/csrf";
import { decryptCredentials } from "@/lib/integrationSecrets";
import { ArborClient } from "@/lib/integrations/arbor/client";
import { compareArborStudents } from "@/lib/integrations/arbor/studentComparison";
import type { ArborCredentials } from "@/lib/integrations/arbor/types";
import { PLATFORM_TENANT_ID } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

export const POST = withApi(async function POST(req: Request) {
  const actor = await requireSuperAdminUser();
  const form = await req.formData();
  try {
    await assertCsrfFromForm(form);
  } catch {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const db = prisma as any;
  const integration = await db.sharedIntegration.findUnique({
    where: { provider: "ARBOR" },
    include: { schools: { where: { enabled: true }, include: { tenant: { include: { tenantSettings: true } } } } },
  });
  if (!integration?.credentialsCiphertext || integration.status !== "CONNECTED") {
    return NextResponse.redirect(new URL("/god/integrations/arbor?comparison=not-connected", req.url));
  }

  try {
    const tenantIdBySchoolType: { PRIMARY?: string; SECONDARY?: string } = {};
    for (const school of integration.schools) {
      const schoolType = school.tenant.tenantSettings?.schoolType;
      if (schoolType === "PRIMARY" || schoolType === "SECONDARY") tenantIdBySchoolType[schoolType] = school.tenantId;
    }
    const tenantIds = Object.values(tenantIdBySchoolType);
    const [arborStudents, existingStudents] = await Promise.all([
      new ArborClient(decryptCredentials<ArborCredentials>(integration.credentialsCiphertext)).listAllStudents(),
      db.student.findMany({
        where: { tenantId: { in: tenantIds } },
        select: { tenantId: true, fullName: true, yearGroup: true, externalId: true, dataSource: true },
      }),
    ]);
    const comparison = compareArborStudents(arborStudents, tenantIdBySchoolType, existingStudents);

    await db.auditLog.create({
      data: {
        tenantId: PLATFORM_TENANT_ID,
        actorUserId: actor.id,
        action: "integration.arbor.students_compared",
        targetType: "SharedIntegration",
        targetId: integration.id,
        afterJson: comparison,
      },
    });

    const url = new URL("/god/integrations/arbor", req.url);
    url.searchParams.set("comparison", "success");
    for (const [key, value] of Object.entries(comparison)) url.searchParams.set(key, String(value));
    return NextResponse.redirect(url);
  } catch {
    return NextResponse.redirect(new URL("/god/integrations/arbor?comparison=failed", req.url));
  }
});
