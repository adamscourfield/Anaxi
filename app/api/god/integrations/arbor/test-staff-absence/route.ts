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
  const integration = await db.sharedIntegration.findUnique({ where: { provider: "ARBOR" } });
  if (!integration?.credentialsCiphertext || integration.status !== "CONNECTED") {
    return NextResponse.redirect(new URL("/god/integrations/arbor?leaveAccess=not-connected", req.url));
  }

  try {
    const result = await new ArborClient(decryptCredentials<ArborCredentials>(integration.credentialsCiphertext)).inspectStaffAbsenceAccess();
    await db.sharedIntegration.update({
      where: { id: integration.id },
      data: {
        config: {
          ...(integration.config ?? {}),
          leaveAbsenceAccess: { status: "VERIFIED", checkedAt: new Date().toISOString() },
        },
      },
    });
    await db.auditLog.create({
      data: {
        tenantId: PLATFORM_TENANT_ID,
        actorUserId: actor.id,
        action: "integration.arbor.staff_absence_access_checked",
        targetType: "SharedIntegration",
        targetId: integration.id,
        afterJson: { fields: result.fields, writeOperations: result.writeOperations },
      },
    });
    const url = new URL("/god/integrations/arbor?leaveAccess=success", req.url);
    url.searchParams.set("leaveWriteOperations", String(result.writeOperations.length));
    return NextResponse.redirect(url);
  } catch {
    // Keep the warning visible after the redirect query parameters have gone.
    await db.sharedIntegration.update({
      where: { id: integration.id },
      data: {
        config: {
          ...(integration.config ?? {}),
          leaveAbsenceAccess: { status: "NEEDS_ATTENTION", checkedAt: new Date().toISOString() },
        },
      },
    });
    return NextResponse.redirect(new URL("/god/integrations/arbor?leaveAccess=failed", req.url));
  }
});
