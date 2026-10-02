import { NextResponse } from "next/server";
import { requireSuperAdminUser } from "@/lib/admin";
import { withApi } from "@/lib/apiRoute";
import { assertCsrfFromForm } from "@/lib/csrf";
import { decryptCredentials } from "@/lib/integrationSecrets";
import { ArborClient } from "@/lib/integrations/arbor/client";
import type { ArborCredentials } from "@/lib/integrations/arbor/types";
import { prisma } from "@/lib/prisma";

function suggestFormat(values: string[]): string {
  const normalized = values.map((value) => value.trim().toUpperCase()).filter(Boolean);
  if (normalized.length === 0) return "needs review";
  if (normalized.every((value) => /^(A\*|A|B|C|D|E|U)$/.test(value))) return "A-level grades";
  if (normalized.some((value) => value.includes("%"))) return "percentages";
  if (normalized.every((value) => /^\d+(\.\d+)?$/.test(value))) {
    const numbers = normalized.map(Number);
    if (numbers.every((value) => value >= 0 && value <= 9)) return "GCSE-style grades or a raw score";
    if (numbers.every((value) => value >= 0 && value <= 100)) return "percentages or a raw score";
  }
  return "needs review";
}

export const POST = withApi(async function POST(req: Request) {
  await requireSuperAdminUser();
  const form = await req.formData();
  try { await assertCsrfFromForm(form); } catch { return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }); }
  const db = prisma as any;
  const integration = await db.sharedIntegration.findUnique({ where: { provider: "ARBOR" }, include: { schools: { where: { enabled: true }, select: { tenantId: true } } } });
  if (!integration?.credentialsCiphertext || integration.status !== "CONNECTED") return NextResponse.redirect(new URL("/god/integrations/arbor?assessmentValues=not-connected", req.url));
  try {
    const marks = await new ArborClient(decryptCredentials<ArborCredentials>(integration.credentialsCiphertext)).listAssessmentMarks();
    const linkedIds = new Set((await db.student.findMany({ where: { tenantId: { in: integration.schools.map((school: { tenantId: string }) => school.tenantId) }, externalId: { not: null } }, select: { externalId: true } })).flatMap((student: { externalId: string | null }) => student.externalId ? [student.externalId] : []));
    const values = Array.from(new Set(marks.filter((mark) => linkedIds.has(mark.student.id)).flatMap((mark) => mark.markDisplayValue ? [mark.markDisplayValue.trim()] : []))).slice(0, 12);
    const url = new URL("/god/integrations/arbor", req.url);
    url.searchParams.set("assessmentValues", "success");
    url.searchParams.set("assessmentValueFormat", suggestFormat(values));
    url.searchParams.set("assessmentValueExamples", values.join(", "));
    return NextResponse.redirect(url);
  } catch {
    return NextResponse.redirect(new URL("/god/integrations/arbor?assessmentValues=failed", req.url));
  }
});
