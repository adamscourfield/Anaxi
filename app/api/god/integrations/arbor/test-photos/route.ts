import { NextResponse } from "next/server";
import { requireSuperAdminUser } from "@/lib/admin";
import { withApi } from "@/lib/apiRoute";
import { assertCsrfFromForm } from "@/lib/csrf";
import { decryptCredentials } from "@/lib/integrationSecrets";
import { ArborClient } from "@/lib/integrations/arbor/client";
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
    include: { schools: { where: { enabled: true }, select: { tenantId: true } } },
  });
  if (!integration?.credentialsCiphertext || integration.status !== "CONNECTED") {
    return NextResponse.redirect(new URL("/god/integrations/arbor?photo=not-connected", req.url));
  }

  const tenantIds = integration.schools.map((school: { tenantId: string }) => school.tenantId);
  const student = await db.student.findFirst({
    where: { tenantId: { in: tenantIds }, dataSource: "ARBOR", externalId: { not: null }, status: "ACTIVE" },
    select: { externalId: true },
    orderBy: { id: "asc" },
  });
  if (!student?.externalId) return NextResponse.redirect(new URL("/god/integrations/arbor?photo=no-student", req.url));

  try {
    await new ArborClient(decryptCredentials<ArborCredentials>(integration.credentialsCiphertext)).verifyStudentPhotoAccess(student.externalId);
    await db.auditLog.create({
      data: { tenantId: PLATFORM_TENANT_ID, actorUserId: actor.id, action: "integration.arbor.photo_access_verified", targetType: "SharedIntegration", targetId: integration.id },
    });
    return NextResponse.redirect(new URL("/god/integrations/arbor?photo=success", req.url));
  } catch {
    return NextResponse.redirect(new URL("/god/integrations/arbor?photo=unavailable", req.url));
  }
});
