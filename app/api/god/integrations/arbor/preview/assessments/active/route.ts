import { NextResponse } from "next/server";
import { requireSuperAdminUser } from "@/lib/admin";
import { withApi } from "@/lib/apiRoute";
import { assertCsrfFromForm } from "@/lib/csrf";
import { decryptCredentials } from "@/lib/integrationSecrets";
import { ArborClient } from "@/lib/integrations/arbor/client";
import type { ArborCredentials } from "@/lib/integrations/arbor/types";
import { prisma } from "@/lib/prisma";

type AssessmentDefinition = { id: string; displayName: string | null; assessmentName: string | null; assessmentShortName: string | null };

function label(assessment: AssessmentDefinition): string {
  return assessment.assessmentName || assessment.assessmentShortName || assessment.displayName || "Untitled assessment";
}

/** The agreed attainment families. Effort grades and rankings deliberately stay out. */
function isApprovedAssessment(name: string): boolean {
  return /^(P8|A Level|%)/i.test(name)
    || /^UL-/i.test(name)
    || name === "UL Writing"
    || /^KS2 SATs/i.test(name)
    || name === "Year 1 Phonics Tracking";
}

export const POST = withApi(async function POST(req: Request) {
  await requireSuperAdminUser();
  const form = await req.formData();
  try { await assertCsrfFromForm(form); } catch { return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }); }

  const db = prisma as any;
  const integration = await db.sharedIntegration.findUnique({ where: { provider: "ARBOR" } });
  if (!integration?.credentialsCiphertext || integration.status !== "CONNECTED") {
    return NextResponse.redirect(new URL("/god/integrations/arbor?assessmentActive=not-connected", req.url));
  }

  try {
    // This reads only the catalogue. Mark pages are deliberately deferred to the paced job.
    const client = new ArborClient(decryptCredentials<ArborCredentials>(integration.credentialsCiphertext));
    const definitions = await client.listAllAssessmentDefinitions();
    const approved = definitions
      .map((definition) => ({ id: definition.id, label: label(definition) }))
      .filter((definition) => isApprovedAssessment(definition.label))
      .sort((a, b) => a.label.localeCompare(b.label));
    const config = integration.config && typeof integration.config === "object" ? integration.config as Record<string, unknown> : {};
    await db.sharedIntegration.update({
      where: { id: integration.id },
      data: { config: { ...config, assessmentSync: { definitions: approved, cursor: 0, inspected: 0, matchedMarks: 0, preparedAt: new Date().toISOString() } } },
    });
    const url = new URL("/god/integrations/arbor", req.url);
    url.searchParams.set("assessmentActive", "prepared");
    url.searchParams.set("assessmentActiveDefinitions", String(approved.length));
    url.searchParams.set("assessmentActiveLabels", approved.slice(0, 12).map((definition) => definition.label).join(" | "));
    return NextResponse.redirect(url);
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 180) : "Arbor did not complete the preparation.";
    const url = new URL("/god/integrations/arbor", req.url);
    url.searchParams.set("assessmentActive", "failed");
    url.searchParams.set("assessmentActiveError", message);
    return NextResponse.redirect(url);
  }
});
