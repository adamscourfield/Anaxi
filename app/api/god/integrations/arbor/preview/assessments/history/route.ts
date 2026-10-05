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
type AssessmentSyncState = {
  definitions?: PreparedDefinition[];
  historicalDefinitions?: PreparedDefinition[];
  historicPage?: number;
  historicDefinitionCursor?: number;
  historicDefinitionPage?: number;
  historicComplete?: boolean;
};

export const POST = withApi(async function POST(req: Request) {
  await requireSuperAdminUser();
  const form = await req.formData();
  try { await assertCsrfFromForm(form); } catch { return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }); }
  const db = prisma as any;
  const integration = await db.sharedIntegration.findUnique({ where: { provider: "ARBOR" } });
  if (!integration?.credentialsCiphertext || integration.status !== "CONNECTED") return NextResponse.redirect(new URL("/god/integrations/arbor?assessmentActive=not-connected", req.url));

  try {
    const config = integration.config && typeof integration.config === "object" ? integration.config as Record<string, unknown> : {};
    const savedState = config.assessmentSync && typeof config.assessmentSync === "object" ? config.assessmentSync as AssessmentSyncState : {};
    // A previous feed-wide scan can complete without reaching historic data.
    // A manual recheck restarts the safe, definition-by-definition approach.
    const state: AssessmentSyncState = savedState.historicComplete
      ? { ...savedState, historicalDefinitions: [], historicPage: 0, historicDefinitionCursor: 0, historicDefinitionPage: 0, historicComplete: false }
      : savedState;
    const client = new ArborClient(decryptCredentials<ArborCredentials>(integration.credentialsCiphertext));
    const definitions = Array.isArray(state.definitions)
      ? state.definitions.filter((item): item is PreparedDefinition => typeof item?.id === "string" && typeof item?.label === "string")
      : [];
    const definitionCursor = typeof state.historicDefinitionCursor === "number" && state.historicDefinitionCursor >= 0
      ? state.historicDefinitionCursor
      : 0;
    const definitionPage = typeof state.historicDefinitionPage === "number" && state.historicDefinitionPage >= 0
      ? state.historicDefinitionPage
      : 0;
    // Query a single known definition at a time. Arbor's all-marks pagination
    // is not chronologically ordered, so it can repeatedly surface current
    // records while leaving prior academic years undiscovered.
    const definition = definitions[definitionCursor];
    const page = definition ? definitionPage : (typeof state.historicPage === "number" && state.historicPage >= 0 ? state.historicPage : 0);
    const marks = await client.listAssessmentMarks(100, page, definition ? [definition.id] : undefined);
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
    const morePagesForDefinition = marks.length === 100;
    const nextDefinitionCursor = definition && !morePagesForDefinition ? definitionCursor + 1 : definitionCursor;
    const historicComplete = definition
      ? !morePagesForDefinition && nextDefinitionCursor >= definitions.length
      : marks.length < 100;
    const nextState = {
      ...state,
      historicalDefinitions: [...combined.values()],
      historicPage: definition ? state.historicPage : (morePagesForDefinition ? page + 1 : page),
      historicDefinitionCursor: definition ? nextDefinitionCursor : state.historicDefinitionCursor,
      historicDefinitionPage: definition ? (morePagesForDefinition ? definitionPage + 1 : 0) : state.historicDefinitionPage,
      historicComplete,
    };
    await db.sharedIntegration.update({ where: { id: integration.id }, data: { config: { ...config, assessmentSync: nextState } } });
    const url = new URL("/god/integrations/arbor", req.url);
    url.searchParams.set("assessmentHistory", historicComplete ? "complete" : "progress");
    url.searchParams.set("assessmentHistoryCycles", String(combined.size));
    return NextResponse.redirect(url);
  } catch (error) {
    const url = new URL("/god/integrations/arbor", req.url);
    url.searchParams.set("assessmentHistory", "failed");
    url.searchParams.set("assessmentHistoryError", error instanceof Error ? error.message.slice(0, 180) : "Historic cycle discovery failed.");
    return NextResponse.redirect(url);
  }
});
