import { NextResponse } from "next/server";
import { requireSuperAdminUser } from "@/lib/admin";
import { withApi } from "@/lib/apiRoute";
import { assertCsrfFromForm } from "@/lib/csrf";
import { decryptCredentials } from "@/lib/integrationSecrets";
import { ArborClient } from "@/lib/integrations/arbor/client";
import { ArborGraphqlError } from "@/lib/integrations/arbor/graphqlClient";
import type { ArborCredentials } from "@/lib/integrations/arbor/types";
import { PLATFORM_TENANT_ID } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

function testFailureMessage(error: unknown): string {
  if (error instanceof ArborGraphqlError) {
    return "Arbor rejected the requested read access. Review the Anaxi app permissions in Arbor.";
  }
  return "Anaxi could not reach Arbor with the saved application credentials.";
}

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
  if (!integration?.credentialsCiphertext) {
    return NextResponse.redirect(new URL("/god/integrations/arbor?test=not-configured", req.url));
  }

  try {
    const credentials = decryptCredentials<ArborCredentials>(integration.credentialsCiphertext);
    await new ArborClient(credentials).verifyConnection();

    await db.sharedIntegration.update({
      where: { id: integration.id },
      data: { status: "CONNECTED", lastSyncError: null },
    });
    await db.auditLog.create({
      data: {
        tenantId: PLATFORM_TENANT_ID,
        actorUserId: actor.id,
        action: "integration.arbor.connection_verified",
        targetType: "SharedIntegration",
        targetId: integration.id,
        afterJson: { outcome: "CONNECTED" },
      },
    });

    return NextResponse.redirect(new URL("/god/integrations/arbor?test=success", req.url));
  } catch (error) {
    const message = testFailureMessage(error);
    await db.sharedIntegration.update({
      where: { id: integration.id },
      data: { status: "ERROR", lastSyncError: message },
    });
    await db.auditLog.create({
      data: {
        tenantId: PLATFORM_TENANT_ID,
        actorUserId: actor.id,
        action: "integration.arbor.connection_check_failed",
        targetType: "SharedIntegration",
        targetId: integration.id,
        afterJson: { outcome: "ERROR", message },
      },
    });

    return NextResponse.redirect(new URL("/god/integrations/arbor?test=failed", req.url));
  }
});
