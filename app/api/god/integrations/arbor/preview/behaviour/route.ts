import { NextResponse } from "next/server";
import { arborConnectionWhere } from "@/lib/integrations/arbor/connectionScope";
import { requireSuperAdminUser } from "@/lib/admin";
import { withApi } from "@/lib/apiRoute";
import { assertCsrfFromForm } from "@/lib/csrf";
import { decryptCredentials } from "@/lib/integrationSecrets";
import { ArborClient } from "@/lib/integrations/arbor/client";
import type { ArborCredentials } from "@/lib/integrations/arbor/types";
import { prisma } from "@/lib/prisma";

/** A read-only check of the Arbor behaviour sources before any sync is enabled. */
export const POST = withApi(async function POST(req: Request) {
  await requireSuperAdminUser();
  const form = await req.formData();
  try { await assertCsrfFromForm(form); } catch { return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }); }
  const integration = await (prisma as any).sharedIntegration.findFirst({ where: arborConnectionWhere(req) });
  if (!integration?.credentialsCiphertext || integration.status !== "CONNECTED") {
    return NextResponse.redirect(new URL("/god/integrations/arbor?behaviour=not-connected", req.url));
  }
  try {
    const result = await new ArborClient(decryptCredentials<ArborCredentials>(integration.credentialsCiphertext)).verifyBehaviourAccess();
    const url = new URL("/god/integrations/arbor", req.url);
    url.searchParams.set("behaviour", "success");
    for (const [key, value] of Object.entries(result)) url.searchParams.set(`behaviour${key[0].toUpperCase()}${key.slice(1)}`, String(value));
    return NextResponse.redirect(url);
  } catch {
    return NextResponse.redirect(new URL("/god/integrations/arbor?behaviour=failed", req.url));
  }
});
