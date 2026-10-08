import { NextResponse } from "next/server";
import { arborConnectionWhere } from "@/lib/integrations/arbor/connectionScope";
import { requireSuperAdminUser } from "@/lib/admin";
import { withApi } from "@/lib/apiRoute";
import { assertCsrfFromForm } from "@/lib/csrf";
import { decryptCredentials } from "@/lib/integrationSecrets";
import { ArborClient } from "@/lib/integrations/arbor/client";
import type { ArborCredentials } from "@/lib/integrations/arbor/types";
import { prisma } from "@/lib/prisma";

/** Inspects schema only; no assessment records are read or changed. */
export const POST = withApi(async function POST(req: Request) {
  await requireSuperAdminUser();
  const form = await req.formData();
  try { await assertCsrfFromForm(form); } catch { return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }); }
  const integration = await (prisma as any).sharedIntegration.findFirst({ where: arborConnectionWhere(req) });
  if (!integration?.credentialsCiphertext || integration.status !== "CONNECTED") return NextResponse.redirect(new URL("/god/integrations/arbor?assessmentSourceFields=not-connected", req.url));
  const url = new URL("/god/integrations/arbor", req.url);
  const connectionId = new URL(req.url).searchParams.get("connectionId");
  if (connectionId) url.searchParams.set("connectionId", connectionId);
  try {
    const fields = await new ArborClient(decryptCredentials<ArborCredentials>(integration.credentialsCiphertext)).inspectHistoricAssessmentSourceFields();
    // The full source schema can exceed browser URL limits. This diagnostic is
    // currently investigating the subject-to-mark join, so return only the
    // two compact measurement-period models needed for that decision.
    const focusedSources = ["ProgressAssessmentBatchTargetMeasurementPeriod", "ProgressMeasurementPeriod"];
    url.searchParams.set("assessmentSourceFields", "success");
    url.searchParams.set("assessmentSourceFieldDetails", focusedSources
      .map((source) => `${source}: ${(fields[source] ?? []).filter((field) => !field.startsWith("query arguments:")).join(", ") || "none"}`)
      .join(" | "));
  } catch {
    url.searchParams.set("assessmentSourceFields", "failed");
  }
  return NextResponse.redirect(url);
});
