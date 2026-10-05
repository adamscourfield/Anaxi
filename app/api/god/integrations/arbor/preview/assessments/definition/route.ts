import { NextResponse } from "next/server";
import { arborConnectionWhere } from "@/lib/integrations/arbor/connectionScope";
import { requireSuperAdminUser } from "@/lib/admin";
import { withApi } from "@/lib/apiRoute";
import { assertCsrfFromForm } from "@/lib/csrf";
import { decryptCredentials } from "@/lib/integrationSecrets";
import { ArborClient } from "@/lib/integrations/arbor/client";
import type { ArborCredentials } from "@/lib/integrations/arbor/types";
import { prisma } from "@/lib/prisma";

const FIELDS_NEEDED_FOR_MAPPING = ["displayName", "assessment", "subject", "gradePointScale", "markType", "markMinValue", "markMaxValue"];

export const POST = withApi(async function POST(req: Request) {
  await requireSuperAdminUser();
  const form = await req.formData();
  try { await assertCsrfFromForm(form); } catch { return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }); }
  const integration = await (prisma as any).sharedIntegration.findFirst({ where: arborConnectionWhere(req) });
  if (!integration?.credentialsCiphertext || integration.status !== "CONNECTED") return NextResponse.redirect(new URL("/god/integrations/arbor?assessmentDefinition=not-connected", req.url));
  try {
    const fields = await new ArborClient(decryptCredentials<ArborCredentials>(integration.credentialsCiphertext)).inspectAdHocAssessmentFields();
    const confirmed = FIELDS_NEEDED_FOR_MAPPING.filter((field) => fields.includes(field));
    const url = new URL("/god/integrations/arbor", req.url);
    url.searchParams.set("assessmentDefinition", "success");
    url.searchParams.set("assessmentDefinitionFields", confirmed.join(","));
    return NextResponse.redirect(url);
  } catch {
    return NextResponse.redirect(new URL("/god/integrations/arbor?assessmentDefinition=failed", req.url));
  }
});
