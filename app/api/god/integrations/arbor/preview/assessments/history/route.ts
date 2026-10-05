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
  historicDiscoveryVersion?: number;
};

const HISTORIC_DISCOVERY_VERSION = 4;
const DEFINITIONS_PER_RUN = 12;

function pauseForArbor(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 500));
}

function assessmentYearRange(label: string): { from: string; before: string } | undefined {
  const match = label.match(/\b(20\d{2})\s*[-/]\s*(20\d{2})\b/);
  if (!match || Number(match[2]) !== Number(match[1]) + 1) return undefined;
  return { from: `${match[1]}-09-01`, before: `${match[2]}-09-01` };
}

function historicDiscoveryOrder(definitions: PreparedDefinition[]): PreparedDefinition[] {
  const yearScore = (label: string) => /2025\s*[-/]\s*2026/.test(label) ? 0 : /2024\s*[-/]\s*2025/.test(label) ? 1 : /2026\s*[-/]\s*2027/.test(label) ? 2 : 3;
  const familyOrder = ["GCSE", "A_LEVEL", "Y10_PERCENTAGE", "KS3_PERCENTAGE"] as const;
  const groups = new Map<string, PreparedDefinition[]>();
  for (const definition of definitions) {
    const mapping = mapArborAssessment(definition.label);
    if (!mapping) continue;
    const key = `${yearScore(definition.label)}:${mapping.family}`;
    const group = groups.get(key) ?? [];
    group.push(definition);
    groups.set(key, group);
  }
  for (const group of groups.values()) group.sort((a, b) => a.label.localeCompare(b.label));
  const ordered: PreparedDefinition[] = [];
  // Round-robin families so an early batch represents all expected pathways,
  // rather than returning a long run of alphabetically first KS3 subjects.
  for (const year of [0, 1, 2, 3]) {
    let added = true;
    while (added) {
      added = false;
      for (const family of familyOrder) {
        const next = groups.get(`${year}:${family}`)?.shift();
        if (next) { ordered.push(next); added = true; }
      }
    }
  }
  return ordered;
}

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
    // Version one inspected only a single definition per action. Restart it so
    // discovery uses the batched, date-led approach below.
    const state: AssessmentSyncState = savedState.historicComplete || savedState.historicDiscoveryVersion !== HISTORIC_DISCOVERY_VERSION
      ? { ...savedState, historicalDefinitions: [], historicPage: 0, historicDefinitionCursor: 0, historicDefinitionPage: 0, historicComplete: false }
      : savedState;
    const client = new ArborClient(decryptCredentials<ArborCredentials>(integration.credentialsCiphertext));
    const definitions = historicDiscoveryOrder(Array.isArray(state.definitions)
      ? state.definitions.filter((item): item is PreparedDefinition => typeof item?.id === "string" && typeof item?.label === "string" && Boolean(mapArborAssessment(item.label)))
      : []);
    let definitionCursor = typeof state.historicDefinitionCursor === "number" && state.historicDefinitionCursor >= 0
      ? state.historicDefinitionCursor
      : 0;
    let definitionPage = typeof state.historicDefinitionPage === "number" && state.historicDefinitionPage >= 0
      ? state.historicDefinitionPage
      : 0;
    const known = Array.isArray(state.historicalDefinitions) ? state.historicalDefinitions : [];
    const combined = new Map<string, PreparedDefinition>();
    for (const item of known) {
      const mapping = mapArborAssessment(item.label, item.assessmentDate);
      if (mapping) combined.set(`${item.id}:${mapping.cycleExternalId}`, item);
    }
    // Arbor does not guarantee chronological ordering for its all-marks feed.
    // Read known definitions directly, twelve at a time, using 500 marks so a
    // normal subject captures both Autumn and Spring dates in one request.
    for (let inspected = 0; inspected < DEFINITIONS_PER_RUN && definitionCursor < definitions.length; inspected++) {
      const definition = definitions[definitionCursor];
      if (inspected > 0) await pauseForArbor();
      const marks = await client.listAssessmentMarks(500, definitionPage, [definition.id], assessmentYearRange(definition.label));
      for (const mark of marks) {
        if (!mark.assessment) continue;
        const label = arborAssessmentLabel(mark.assessment);
        const mapping = mapArborAssessment(label, mark.assessmentDate);
        if (mapping) combined.set(`${mark.assessment.id}:${mapping.cycleExternalId}`, { id: mark.assessment.id, label, assessmentDate: mark.assessmentDate });
      }
      if (marks.length < 500) {
        definitionCursor++;
        definitionPage = 0;
      } else {
        definitionPage++;
      }
    }
    const historicComplete = definitionCursor >= definitions.length;
    const nextState = {
      ...state,
      historicalDefinitions: [...combined.values()],
      historicDefinitionCursor: definitionCursor,
      historicDefinitionPage: definitionPage,
      historicComplete,
      historicDiscoveryVersion: HISTORIC_DISCOVERY_VERSION,
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
