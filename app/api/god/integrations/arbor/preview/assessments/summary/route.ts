import { NextResponse } from "next/server";
import { requireSuperAdminUser } from "@/lib/admin";
import { withApi } from "@/lib/apiRoute";
import { assertCsrfFromForm } from "@/lib/csrf";
import { decryptCredentials } from "@/lib/integrationSecrets";
import { ArborClient } from "@/lib/integrations/arbor/client";
import type { ArborCredentials } from "@/lib/integrations/arbor/types";
import { prisma } from "@/lib/prisma";

export const POST = withApi(async function POST(req: Request) {
  await requireSuperAdminUser(); const form = await req.formData();
  try { await assertCsrfFromForm(form); } catch { return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }); }
  const db = prisma as any; const integration = await db.sharedIntegration.findUnique({ where: { provider: "ARBOR" }, include: { schools: { where: { enabled: true }, select: { tenantId: true } } } });
  if (!integration?.credentialsCiphertext || integration.status !== "CONNECTED") return NextResponse.redirect(new URL("/god/integrations/arbor?assessmentPreview=not-connected", req.url));
  try {
    const marks = await new ArborClient(decryptCredentials<ArborCredentials>(integration.credentialsCiphertext)).listAssessmentMarks();
    const ids = new Set((await db.student.findMany({ where: { tenantId: { in: integration.schools.map((s: { tenantId: string }) => s.tenantId) }, dataSource: "ARBOR", externalId: { not: null } }, select: { externalId: true } })).flatMap((s: { externalId: string | null }) => s.externalId ? [s.externalId] : []));
    const linked = marks.filter((mark) => ids.has(mark.student.id));
    const assessments = new Set(linked.flatMap((mark) => mark.adHocAssessment ? [mark.adHocAssessment.id] : []));
    const url = new URL("/god/integrations/arbor", req.url); for (const [key, value] of Object.entries({ assessmentPreview: "success", assessmentMarks: marks.length, assessmentLinked: linked.length, assessmentDefinitions: assessments.size })) url.searchParams.set(key, String(value)); return NextResponse.redirect(url);
  } catch { return NextResponse.redirect(new URL("/god/integrations/arbor?assessmentPreview=failed", req.url)); }
});
