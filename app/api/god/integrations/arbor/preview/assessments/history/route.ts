import { NextResponse } from "next/server";
import { requireSuperAdminUser } from "@/lib/admin";
import { withApi } from "@/lib/apiRoute";
import { assertCsrfFromForm } from "@/lib/csrf";
import { decryptCredentials } from "@/lib/integrationSecrets";
import { ArborClient } from "@/lib/integrations/arbor/client";
import { arborAssessmentLabel, mapArborAssessment } from "@/lib/integrations/arbor/assessmentPolicy";
import type { ArborCredentials } from "@/lib/integrations/arbor/types";
import { prisma } from "@/lib/prisma";

type PreparedDefinition = { id: string; label: string; assessmentDate?: string | null };
type AssessmentSyncState = { definitions?: PreparedDefinition[]; historicalDefinitions?: PreparedDefinition[]; historicPage?: number; historicComplete?: boolean };

export const POST = withApi(async function POST(req: Request) {
  await requireSuperAdminUser();
  const form = await req.formData();
  try { await assertCsrfFromForm(form); } catch { return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }); }
  const db = prisma as any;
  const integration = await db.sharedIntegration.findUnique({ where: { provider: "ARBOR" } });
  if (!integration?.credentialsCiphertext || integration.status !== "CONNECTED") return NextResponse.redirect(new URL("/god/integrations/arbor?assessmentActive=not-connected", req.url));

  try {
    const config = integration.config && typeof integration.config === "object" ? integration.config as Record<string, unknown> : {};
    const state = config.assessmentSync && typeof config.assessmentSync === "object" ? config.assessmentSync as AssessmentSyncState : {};
    const page = typeof state.historicPage === "number" && state.historicPage >= 0 ? state.historicPage : 0;
    const marks = await new ArborClient(decryptCredentials<ArborCredentials>(integration.credentialsCiphertext)).listAssessmentMarks(100, page);
    const known = Array.isArray(state.historicalDefinitions) ? state.historicalDefinitions : [];
    const combined = new Map<string, PreparedDefinition>();
    for (const item of known) {
      const mapping = mapArborAssessment(item.label, item.assessmentDate);
      if (mapping) combined.set(`${item.id}:${mapping.cycleExternalId}`, item);
    }
    for (const mark of marks) {
      if (!mark.assessment) continue;
      const label = arborAssessmentLabel(mark.assessment);
      const mapping = mapArborAssessment(label, mark.assessmentDate);
      if (mapping) combined.set(`${mark.assessment.id}:${mapping.cycleExternalId}`, { id: mark.assessment.id, label, assessmentDate: mark.assessmentDate });
    }
    const nextState = { ...state, historicalDefinitions: [...combined.values()], historicPage: marks.length === 100 ? page + 1 : page, historicComplete: marks.length < 100 };
    await db.sharedIntegration.update({ where: { id: integration.id }, data: { config: { ...config, assessmentSync: nextState } } });
    const url = new URL("/god/integrations/arbor", req.url);
    url.searchParams.set("assessmentHistory", marks.length < 100 ? "complete" : "progress");
    url.searchParams.set("assessmentHistoryCycles", String(combined.size));
    return NextResponse.redirect(url);
  } catch (error) {
    const url = new URL("/god/integrations/arbor", req.url);
    url.searchParams.set("assessmentHistory", "failed");
    url.searchParams.set("assessmentHistoryError", error instanceof Error ? error.message.slice(0, 180) : "Historic cycle discovery failed.");
    return NextResponse.redirect(url);
  }
});
