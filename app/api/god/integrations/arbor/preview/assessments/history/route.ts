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
  historicYearCursor?: number;
  historicFamilyCursor?: number;
  historicDefinitionChunk?: number;
  historicMarkPage?: number;
  historicComplete?: boolean;
  historicDiscoveryVersion?: number;
};

const HISTORIC_DISCOVERY_VERSION = 6;
const MARK_PAGES_PER_RUN = 12;
const DEFINITIONS_PER_QUERY = 25;
const HISTORIC_FAMILY_ORDER = ["GCSE", "A_LEVEL", "Y10_PERCENTAGE", "KS3_PERCENTAGE"] as const;
const HISTORIC_ACADEMIC_YEARS = [
  { label: "2025/2026", from: "2025-09-01", before: "2026-09-01" },
  { label: "2024/2025", from: "2024-09-01", before: "2025-09-01" },
  { label: "2026/2027", from: "2026-09-01", before: "2027-09-01" },
] as const;

function pauseForArbor(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 500));
}

function definitionsForFamily(definitions: PreparedDefinition[], family: (typeof HISTORIC_FAMILY_ORDER)[number]): PreparedDefinition[] {
  return definitions
    .filter((definition) => mapArborAssessment(definition.label)?.family === family)
    .sort((a, b) => a.label.localeCompare(b.label));
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
    // Earlier versions read every definition's entire mark history in turn.
    // Restart safely so discovery instead scans each academic year once and
    // groups every matching subject it finds into the same proposed cycle.
    const state: AssessmentSyncState = savedState.historicComplete || savedState.historicDiscoveryVersion !== HISTORIC_DISCOVERY_VERSION
      ? { ...savedState, historicalDefinitions: [], historicYearCursor: 0, historicFamilyCursor: 0, historicDefinitionChunk: 0, historicMarkPage: 0, historicComplete: false }
      : savedState;
    const client = new ArborClient(decryptCredentials<ArborCredentials>(integration.credentialsCiphertext));
    const definitions = Array.isArray(state.definitions)
      ? state.definitions.filter((item): item is PreparedDefinition => typeof item?.id === "string" && typeof item?.label === "string" && Boolean(mapArborAssessment(item.label)))
      : [];
    let yearCursor = typeof state.historicYearCursor === "number" && state.historicYearCursor >= 0
      ? state.historicYearCursor
      : 0;
    let familyCursor = typeof state.historicFamilyCursor === "number" && state.historicFamilyCursor >= 0
      ? state.historicFamilyCursor
      : 0;
    let definitionChunk = typeof state.historicDefinitionChunk === "number" && state.historicDefinitionChunk >= 0
      ? state.historicDefinitionChunk
      : 0;
    let markPage = typeof state.historicMarkPage === "number" && state.historicMarkPage >= 0
      ? state.historicMarkPage
      : 0;
    const known = Array.isArray(state.historicalDefinitions) ? state.historicalDefinitions : [];
    const combined = new Map<string, PreparedDefinition>();
    for (const item of known) {
      const mapping = mapArborAssessment(item.label, item.assessmentDate);
      if (mapping) combined.set(`${item.id}:${mapping.cycleExternalId}`, item);
    }
    // Ask Arbor for each agreed family directly. Its broad dated-mark ordering
    // puts the much larger percentage cohort ahead of P8 and A-Level records.
    // Family chunks ensure GCSE and A-Level cycles are discovered first.
    for (let inspected = 0; inspected < MARK_PAGES_PER_RUN && yearCursor < HISTORIC_ACADEMIC_YEARS.length; inspected++) {
      if (familyCursor >= HISTORIC_FAMILY_ORDER.length) {
        yearCursor++;
        familyCursor = 0;
        definitionChunk = 0;
        markPage = 0;
        continue;
      }
      const academicYear = HISTORIC_ACADEMIC_YEARS[yearCursor];
      const family = HISTORIC_FAMILY_ORDER[familyCursor];
      const familyDefinitions = definitionsForFamily(definitions, family);
      const chunks = Array.from({ length: Math.ceil(familyDefinitions.length / DEFINITIONS_PER_QUERY) }, (_, index) => familyDefinitions.slice(index * DEFINITIONS_PER_QUERY, (index + 1) * DEFINITIONS_PER_QUERY));
      if (!chunks[definitionChunk]?.length) {
        familyCursor++;
        definitionChunk = 0;
        markPage = 0;
        continue;
      }
      if (inspected > 0) await pauseForArbor();
      const marks = await client.listAssessmentMarks(500, markPage, chunks[definitionChunk].map((definition) => definition.id), academicYear);
      for (const mark of marks) {
        if (!mark.assessment) continue;
        const label = arborAssessmentLabel(mark.assessment);
        const mapping = mapArborAssessment(label, mark.assessmentDate);
        if (mapping) combined.set(`${mark.assessment.id}:${mapping.cycleExternalId}`, { id: mark.assessment.id, label, assessmentDate: mark.assessmentDate });
      }
      if (marks.length < 500) {
        definitionChunk++;
        markPage = 0;
      } else {
        markPage++;
      }
    }
    const historicComplete = yearCursor >= HISTORIC_ACADEMIC_YEARS.length;
    const nextState = {
      ...state,
      historicalDefinitions: [...combined.values()],
      historicYearCursor: yearCursor,
      historicMarkPage: markPage,
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
