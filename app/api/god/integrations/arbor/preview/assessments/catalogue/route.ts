import { NextResponse } from "next/server";
import { requireSuperAdminUser } from "@/lib/admin";
import { withApi } from "@/lib/apiRoute";
import { assertCsrfFromForm } from "@/lib/csrf";
import { decryptCredentials } from "@/lib/integrationSecrets";
import { ArborClient } from "@/lib/integrations/arbor/client";
import type { ArborCredentials } from "@/lib/integrations/arbor/types";
import { prisma } from "@/lib/prisma";

function label(definition: { displayName: string | null; assessmentName: string | null; assessmentShortName: string | null }): string {
  return definition.assessmentName || definition.assessmentShortName || definition.displayName || "Untitled assessment";
}

function isPriorityAssessment(name: string): boolean {
  return /^(P8|A-Level)\b/i.test(name) || /\b(KS ?[12]|Key Stage ?[12])\b/i.test(name);
}

export const POST = withApi(async function POST(req: Request) {
  await requireSuperAdminUser();
  const form = await req.formData();
  try { await assertCsrfFromForm(form); } catch { return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }); }
  const integration = await (prisma as any).sharedIntegration.findUnique({ where: { provider: "ARBOR" } });
  if (!integration?.credentialsCiphertext || integration.status !== "CONNECTED") return NextResponse.redirect(new URL("/god/integrations/arbor?assessmentCatalogue=not-connected", req.url));
  try {
    const definitions = await new ArborClient(decryptCredentials<ArborCredentials>(integration.credentialsCiphertext)).listAllAssessmentDefinitions();
    const priority = definitions.map(label).filter(isPriorityAssessment).sort((a, b) => a.localeCompare(b));
    const url = new URL("/god/integrations/arbor", req.url);
    url.searchParams.set("assessmentCatalogue", "success");
    url.searchParams.set("assessmentCatalogueTotal", String(definitions.length));
    url.searchParams.set("assessmentCataloguePriority", String(priority.length));
    url.searchParams.set("assessmentCatalogueLabels", priority.slice(0, 12).join(" | "));
    return NextResponse.redirect(url);
  } catch {
    return NextResponse.redirect(new URL("/god/integrations/arbor?assessmentCatalogue=failed", req.url));
  }
});
