import { NextResponse } from "next/server";
import { requireSuperAdminUser } from "@/lib/admin";
import { withApi } from "@/lib/apiRoute";
import { assertCsrfFromForm } from "@/lib/csrf";
import { encryptCredentials } from "@/lib/integrationSecrets";
import { parseArborConnectionForm } from "@/lib/integrations/arbor/connectionForm";
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

  let credentials: ReturnType<typeof parseArborConnectionForm>;
  try {
    credentials = parseArborConnectionForm({
      schoolHostname: form.get("schoolHostname"),
      username: form.get("username"),
      password: form.get("password"),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid Arbor connection details" }, { status: 400 });
  }

  const tenantIds = [...new Set(form.getAll("tenantIds").map(String))].filter((id) => id !== PLATFORM_TENANT_ID);
  const connectionId = typeof form.get("connectionId") === "string" ? String(form.get("connectionId")).trim() : "";
  const label = typeof form.get("label") === "string" ? String(form.get("label")).trim() : "";
  if (tenantIds.length === 0) {
    return NextResponse.json({ error: "Choose at least one school to receive Arbor data." }, { status: 400 });
  }

  const schools = await prisma.tenant.findMany({
    where: { AND: [{ id: { in: tenantIds } }, { id: { not: PLATFORM_TENANT_ID } }] },
    select: { id: true },
  });
  if (schools.length !== tenantIds.length) {
    return NextResponse.json({ error: "One or more selected schools no longer exist." }, { status: 400 });
  }

  const db = prisma as any;
  const existing = connectionId
    ? await db.sharedIntegration.findFirst({ where: { id: connectionId, provider: "ARBOR" } })
    : null;
  if (connectionId && !existing) return NextResponse.json({ error: "That Arbor connection no longer exists." }, { status: 404 });
  const conflictingLinks = await db.sharedIntegrationSchool.findMany({
    where: { tenantId: { in: tenantIds }, integration: { provider: "ARBOR" }, ...(existing ? { integrationId: { not: existing.id } } : {}) },
    select: { tenantId: true },
  });
  if (conflictingLinks.length) {
    return NextResponse.json({ error: "A selected school is already linked to another Arbor connection. Each school can have only one Arbor connection." }, { status: 409 });
  }
  let credentialsCiphertext: string;
  try {
    credentialsCiphertext = encryptCredentials(credentials);
  } catch {
    // Never accept credentials when production secure storage is unavailable.
    return NextResponse.redirect(new URL("/god/integrations/arbor?error=secure-storage", req.url));
  }
  const data = {
    label: label || `${credentials.schoolHostname} Arbor`,
    status: "DISCONNECTED",
    credentialsCiphertext,
    // Retain prior per-connection sync progress and approvals when refreshing credentials.
    config: { ...(existing?.config && typeof existing.config === "object" ? existing.config : {}), schoolHostname: credentials.schoolHostname },
    connectedByUserId: actor.id,
    connectedAt: new Date(),
    lastSyncStatus: null,
    lastSyncError: null,
  };

  const integration = existing
    ? await db.sharedIntegration.update({
        where: { id: existing.id },
        data: {
          ...data,
          schools: {
            deleteMany: {},
            create: tenantIds.map((tenantId) => ({ tenantId, enabled: true })),
          },
        },
      })
    : await db.sharedIntegration.create({
        data: {
          provider: "ARBOR",
          ...data,
          schools: { create: tenantIds.map((tenantId) => ({ tenantId, enabled: true })) },
        },
      });

  await db.auditLog.create({
    data: {
      tenantId: PLATFORM_TENANT_ID,
      actorUserId: actor.id,
      action: "integration.arbor.configure",
      targetType: "SharedIntegration",
      targetId: integration.id,
      // Deliberately do not include credentials in the audit record.
      afterJson: { schoolHostname: credentials.schoolHostname, tenantIds },
    },
  });

  const url = new URL("/god/integrations/arbor", req.url);
  url.searchParams.set("saved", "1");
  url.searchParams.set("connectionId", integration.id);
  return NextResponse.redirect(url);
});
