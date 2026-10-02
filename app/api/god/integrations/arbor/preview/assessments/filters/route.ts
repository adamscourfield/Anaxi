import { NextResponse } from "next/server";
import { requireSuperAdminUser } from "@/lib/admin";
import { withApi } from "@/lib/apiRoute";
import { assertCsrfFromForm } from "@/lib/csrf";
import { decryptCredentials } from "@/lib/integrationSecrets";
import { ArborClient } from "@/lib/integrations/arbor/client";
import type { ArborCredentials } from "@/lib/integrations/arbor/types";
import { prisma } from "@/lib/prisma";

export const POST = withApi(async function POST(req: Request) {
  await requireSuperAdminUser();
  const form = await req.formData();
  try { await assertCsrfFromForm(form); } catch { return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }); }
  const integration = await (prisma as any).sharedIntegration.findUnique({ where: { provider: "ARBOR" } });
  if (!integration?.credentialsCiphertext || integration.status !== "CONNECTED") return NextResponse.redirect(new URL("/god/integrations/arbor?assessmentFilters=not-connected", req.url));
  try {
    const filters = await new ArborClient(decryptCredentials<ArborCredentials>(integration.credentialsCiphertext)).inspectProgressAssessmentMarkFilters();
    const url = new URL("/god/integrations/arbor", req.url);
    url.searchParams.set("assessmentFilters", "success");
    url.searchParams.set("assessmentFilterNames", filters.join(", "));
    return NextResponse.redirect(url);
  } catch {
    return NextResponse.redirect(new URL("/god/integrations/arbor?assessmentFilters=failed", req.url));
  }
});
