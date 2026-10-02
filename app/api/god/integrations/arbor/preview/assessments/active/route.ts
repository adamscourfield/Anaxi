import { NextResponse } from "next/server";
import { requireSuperAdminUser } from "@/lib/admin";
import { withApi } from "@/lib/apiRoute";
import { assertCsrfFromForm } from "@/lib/csrf";
import { decryptCredentials } from "@/lib/integrationSecrets";
import { ArborClient } from "@/lib/integrations/arbor/client";
import type { ArborCredentials } from "@/lib/integrations/arbor/types";
import { prisma } from "@/lib/prisma";

function label(assessment: { displayName: string | null; assessmentName: string | null; assessmentShortName: string | null }): string {
  return assessment.assessmentName || assessment.assessmentShortName || assessment.displayName || "Untitled assessment";
}

function isPriorityAssessment(name: string): boolean {
  return /^(P8|A-Level)\b/i.test(name) || /\b(KS ?[12]|Key Stage ?[12])\b/i.test(name);
}

export const POST = withApi(async function POST(req: Request) {
  await requireSuperAdminUser();
  const form = await req.formData();
  try { await assertCsrfFromForm(form); } catch { return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }); }
  const db = prisma as any;
  const integration = await db.sharedIntegration.findUnique({ where: { provider: "ARBOR" }, include: { schools: { where: { enabled: true }, select: { tenantId: true } } } });
  if (!integration?.credentialsCiphertext || integration.status !== "CONNECTED") return NextResponse.redirect(new URL("/god/integrations/arbor?assessmentActive=not-connected", req.url));
  try {
    const [marks, linkedStudents] = await Promise.all([
      new ArborClient(decryptCredentials<ArborCredentials>(integration.credentialsCiphertext)).listAllAssessmentMarks(),
      db.student.findMany({ where: { tenantId: { in: integration.schools.map((school: { tenantId: string }) => school.tenantId) }, status: "ACTIVE", externalId: { not: null } }, select: { externalId: true } }),
    ]);
    const linkedIds = new Set(linkedStudents.flatMap((student: { externalId: string | null }) => student.externalId ? [student.externalId] : []));
    const matching = marks.filter((mark) => mark.assessment && linkedIds.has(mark.student.id) && isPriorityAssessment(label(mark.assessment)));
    const assessments = new Map(matching.flatMap((mark) => mark.assessment ? [[mark.assessment.id, label(mark.assessment)]] : []));
    const url = new URL("/god/integrations/arbor", req.url);
    url.searchParams.set("assessmentActive", "success");
    url.searchParams.set("assessmentActiveMarks", String(matching.length));
    url.searchParams.set("assessmentActiveDefinitions", String(assessments.size));
    url.searchParams.set("assessmentActiveLabels", [...assessments.values()].sort((a, b) => a.localeCompare(b)).slice(0, 12).join(" | "));
    return NextResponse.redirect(url);
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 180) : "Arbor did not complete the preview.";
    const url = new URL("/god/integrations/arbor", req.url);
    url.searchParams.set("assessmentActive", "failed");
    url.searchParams.set("assessmentActiveError", message);
    return NextResponse.redirect(url);
  }
});
