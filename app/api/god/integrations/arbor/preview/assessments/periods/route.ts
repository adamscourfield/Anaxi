import { NextResponse } from "next/server";
import { arborConnectionWhere } from "@/lib/integrations/arbor/connectionScope";
import { requireSuperAdminUser } from "@/lib/admin";
import { withApi } from "@/lib/apiRoute";
import { assertCsrfFromForm } from "@/lib/csrf";
import { decryptCredentials } from "@/lib/integrationSecrets";
import { ArborClient } from "@/lib/integrations/arbor/client";
import type { ArborCredentials } from "@/lib/integrations/arbor/types";
import { prisma } from "@/lib/prisma";

const PERIOD_FIELD_NAMES = ["assessmentPeriod", "assessmentPoint", "assessmentCycle", "markingPeriod", "term", "academicYear"];

/** Confirms the real Arbor period relationship before extending historic import logic. */
export const POST = withApi(async function POST(req: Request) {
  await requireSuperAdminUser();
  const form = await req.formData();
  try { await assertCsrfFromForm(form); } catch { return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }); }
  const integration = await (prisma as any).sharedIntegration.findFirst({ where: arborConnectionWhere(req) });
  if (!integration?.credentialsCiphertext || integration.status !== "CONNECTED") return NextResponse.redirect(new URL("/god/integrations/arbor?assessmentPeriods=not-connected", req.url));
  try {
    const fields = await new ArborClient(decryptCredentials<ArborCredentials>(integration.credentialsCiphertext)).inspectProgressAssessmentMarkFields();
    const periodFields = PERIOD_FIELD_NAMES.filter((field) => fields.includes(field));
    const url = new URL("/god/integrations/arbor", req.url);
    const connectionId = new URL(req.url).searchParams.get("connectionId");
    if (connectionId) url.searchParams.set("connectionId", connectionId);
    url.searchParams.set("assessmentPeriods", "success");
    url.searchParams.set("assessmentPeriodFields", periodFields.join(",") || "none");
    return NextResponse.redirect(url);
  } catch {
    return NextResponse.redirect(new URL("/god/integrations/arbor?assessmentPeriods=failed", req.url));
  }
});
