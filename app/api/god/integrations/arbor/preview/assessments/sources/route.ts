import { NextResponse } from "next/server";
import { arborConnectionWhere } from "@/lib/integrations/arbor/connectionScope";
import { requireSuperAdminUser } from "@/lib/admin";
import { withApi } from "@/lib/apiRoute";
import { assertCsrfFromForm } from "@/lib/csrf";
import { decryptCredentials } from "@/lib/integrationSecrets";
import { ArborClient } from "@/lib/integrations/arbor/client";
import type { ArborCredentials } from "@/lib/integrations/arbor/types";
import { prisma } from "@/lib/prisma";

/** Identifies which read-only Arbor assessment source contains historic marks. */
export const POST = withApi(async function POST(req: Request) {
  await requireSuperAdminUser();
  const form = await req.formData();
  try { await assertCsrfFromForm(form); } catch { return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }); }
  const integration = await (prisma as any).sharedIntegration.findFirst({ where: arborConnectionWhere(req) });
  if (!integration?.credentialsCiphertext || integration.status !== "CONNECTED") return NextResponse.redirect(new URL("/god/integrations/arbor?assessmentSources=not-connected", req.url));
  const url = new URL("/god/integrations/arbor", req.url);
  const connectionId = new URL(req.url).searchParams.get("connectionId");
  if (connectionId) url.searchParams.set("connectionId", connectionId);
  try {
    const result = await new ArborClient(decryptCredentials<ArborCredentials>(integration.credentialsCiphertext)).inspectHistoricAssessmentSources();
    url.searchParams.set("assessmentSources", "success");
    url.searchParams.set("assessmentSourcesAvailable", result.available.join(", ") || "none");
    url.searchParams.set("assessmentSourcesBlocked", result.blocked.join(", ") || "none");
  } catch {
    url.searchParams.set("assessmentSources", "failed");
  }
  return NextResponse.redirect(url);
});
