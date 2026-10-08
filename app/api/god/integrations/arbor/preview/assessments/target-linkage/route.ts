import { NextResponse } from "next/server";
import { arborConnectionWhere } from "@/lib/integrations/arbor/connectionScope";
import { requireSuperAdminUser } from "@/lib/admin";
import { withApi } from "@/lib/apiRoute";
import { assertCsrfFromForm } from "@/lib/csrf";
import { decryptCredentials } from "@/lib/integrationSecrets";
import { ArborClient } from "@/lib/integrations/arbor/client";
import { arborAssessmentFamily, mapArborAssessment } from "@/lib/integrations/arbor/assessmentPolicy";
import type { ArborCredentials } from "@/lib/integrations/arbor/types";
import { prisma } from "@/lib/prisma";

type PreparedDefinition = { id: string; label: string; assessmentDate?: string | null; periodHint?: string | null; source?: "BATCH" | "BATCH_TARGET" | "PROGRESS_MARK" };

function assessmentYearRange(academicYear: string): { from: string; before: string } | undefined {
  const match = academicYear.match(/^(20\d{2})\/(20\d{2})$/);
  return match ? { from: `${match[1]}-09-01`, before: `${match[2]}-09-01` } : undefined;
}

export const POST = withApi(async function POST(req: Request) {
  await requireSuperAdminUser();
  const form = await req.formData();
  try { await assertCsrfFromForm(form); } catch { return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }); }
  const integration = await (prisma as any).sharedIntegration.findFirst({ where: arborConnectionWhere(req) });
  const url = new URL("/god/integrations/arbor", req.url);
  const connectionId = new URL(req.url).searchParams.get("connectionId");
  if (connectionId) url.searchParams.set("connectionId", connectionId);
  if (!integration?.credentialsCiphertext || integration.status !== "CONNECTED") {
    url.searchParams.set("assessmentTargetLinkage", "not-connected");
    return NextResponse.redirect(url);
  }
  try {
    const config = integration.config && typeof integration.config === "object" ? integration.config as Record<string, unknown> : {};
    const sync = config.assessmentSync && typeof config.assessmentSync === "object" ? config.assessmentSync as { historicalDefinitions?: PreparedDefinition[] } : {};
    const definition = (sync.historicalDefinitions ?? []).find((item) => arborAssessmentFamily(item.label) === "Y10_PERCENTAGE" && item.source === "BATCH");
    if (!definition) throw new Error("No Year 10 batch definition is currently available for inspection.");
    const mapping = mapArborAssessment(definition.label, definition.assessmentDate, definition.periodHint);
    if (!mapping) throw new Error("The selected Year 10 batch could not be mapped.");
    const client = new ArborClient(decryptCredentials<ArborCredentials>(integration.credentialsCiphertext));
    const targets = await client.listProgressAssessmentBatchTargets([definition.id]);
    const assessmentId = targets.find((target) => target.progressAssessmentBatch?.assessment)?.progressAssessmentBatch?.assessment?.id;
    if (!assessmentId) throw new Error("Arbor did not return the Year 10 batch assessment identity.");
    const result = await client.inspectAssessmentBatchTargetLinkage(assessmentId, targets.map((target) => target.id), assessmentYearRange(mapping.academicYear));
    url.searchParams.set("assessmentTargetLinkage", "success");
    url.searchParams.set("assessmentTargetLinkageDetails", `relation ${result.relation ?? "none"}; ${result.total} assessment records read; ${result.dateMatched} in the academic year; ${result.linked} linked to this subject target; ${result.graded} carry a displayed grade; examples: ${result.sample.join(" / ") || "none"}`);
  } catch (error) {
    url.searchParams.set("assessmentTargetLinkage", "failed");
    url.searchParams.set("assessmentTargetLinkageDetails", error instanceof Error ? error.message.slice(0, 500) : "The target linkage diagnostic failed.");
  }
  return NextResponse.redirect(url);
});
