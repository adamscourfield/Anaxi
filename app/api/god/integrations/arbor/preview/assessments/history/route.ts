import { NextResponse } from "next/server";
import { arborConnectionWhere } from "@/lib/integrations/arbor/connectionScope";
import { requireSuperAdminUser } from "@/lib/admin";
import { withApi } from "@/lib/apiRoute";
import { assertCsrfFromForm } from "@/lib/csrf";
import { decryptCredentials } from "@/lib/integrationSecrets";
import { ArborClient } from "@/lib/integrations/arbor/client";
import { arborAssessmentLabel, arborYearGroupAtAssessment, mapArborAssessment, mapArborAssessmentForYearGroup } from "@/lib/integrations/arbor/assessmentPolicy";
import type { ArborCredentials } from "@/lib/integrations/arbor/types";
import { prisma } from "@/lib/prisma";

type PreparedDefinition = { id: string; label: string; assessmentDate?: string | null; periodHint?: string | null; yearGroups?: string[] };
type HistoricFamilyProgress = { chunk?: number; markPage?: number; complete?: boolean };
type AssessmentSyncState = {
  definitions?: PreparedDefinition[];
  historicalDefinitions?: PreparedDefinition[];
  historicYearCursor?: number;
  historicFamilyCursor?: number;
  historicFamilyProgress?: Record<string, HistoricFamilyProgress>;
  historicComplete?: boolean;
  historicDiscoveryVersion?: number;
};

const HISTORIC_DISCOVERY_VERSION = 10;
const MARK_PAGES_PER_RUN = 12;
const DEFINITIONS_PER_QUERY = 1;
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

function addHistoricDefinition(target: Map<string, PreparedDefinition>, definition: PreparedDefinition, mapping: NonNullable<ReturnType<typeof mapArborAssessment>>, currentAcademicLevel: string | null | undefined) {
  const inferredYearGroup = arborYearGroupAtAssessment(currentAcademicLevel, mapping.academicYear)
    ?? (mapping.family === "GCSE" ? "Y11" : null);
  const cycle = inferredYearGroup ? mapArborAssessmentForYearGroup(mapping, inferredYearGroup) : null;
  if (!cycle || !inferredYearGroup) return;
  const key = `${definition.id}:${cycle.cycleExternalId}`;
  const existing = target.get(key);
  target.set(key, { ...definition, yearGroups: [...new Set([...(existing?.yearGroups ?? []), inferredYearGroup])] });
}

export const POST = withApi(async function POST(req: Request) {
  await requireSuperAdminUser();
  const form = await req.formData();
  try { await assertCsrfFromForm(form); } catch {
    const url = new URL("/god/integrations/arbor", req.url);
    const connectionId = new URL(req.url).searchParams.get("connectionId");
    if (connectionId) url.searchParams.set("connectionId", connectionId);
    url.searchParams.set("csrf", "expired");
    return NextResponse.redirect(url);
  }
  const db = prisma as any;
  const integration = await db.sharedIntegration.findFirst({ where: arborConnectionWhere(req) });
  if (!integration?.credentialsCiphertext || integration.status !== "CONNECTED") return NextResponse.redirect(new URL("/god/integrations/arbor?assessmentActive=not-connected", req.url));

  try {
    const config = integration.config && typeof integration.config === "object" ? integration.config as Record<string, unknown> : {};
    const savedState = config.assessmentSync && typeof config.assessmentSync === "object" ? config.assessmentSync as AssessmentSyncState : {};
    // Earlier versions read every definition's entire mark history in turn.
    // Restart safely so discovery instead scans each academic year once and
    // groups every matching subject it finds into the same proposed cycle.
    const state: AssessmentSyncState = savedState.historicComplete || savedState.historicDiscoveryVersion !== HISTORIC_DISCOVERY_VERSION
      ? { ...savedState, historicalDefinitions: [], historicYearCursor: 0, historicFamilyCursor: 0, historicFamilyProgress: {}, historicComplete: false }
      : savedState;
    const client = new ArborClient(decryptCredentials<ArborCredentials>(integration.credentialsCiphertext));
    let definitions = Array.isArray(state.definitions)
      ? state.definitions.filter((item): item is PreparedDefinition => typeof item?.id === "string" && typeof item?.label === "string" && Boolean(mapArborAssessment(item.label)))
      : [];
    // A historic review request must be self-contained. If a deployment or
    // connection migration left the cached catalogue empty, rebuild it here
    // rather than showing the operator an empty review list and requiring a
    // separate, non-obvious preparation step.
    if (!definitions.length) {
      definitions = (await client.listAllAssessmentDefinitions())
        .map((definition) => ({ id: definition.id, label: arborAssessmentLabel(definition) }))
        .filter((definition): definition is PreparedDefinition => Boolean(mapArborAssessment(definition.label)))
        .sort((a, b) => a.label.localeCompare(b.label));
    }
    let yearCursor = typeof state.historicYearCursor === "number" && state.historicYearCursor >= 0
      ? state.historicYearCursor
      : 0;
    let familyCursor = typeof state.historicFamilyCursor === "number" && state.historicFamilyCursor >= 0
      ? state.historicFamilyCursor
      : 0;
    let familyProgress: Record<string, HistoricFamilyProgress> = state.historicFamilyProgress && typeof state.historicFamilyProgress === "object"
      ? { ...state.historicFamilyProgress }
      : {};
    const known = Array.isArray(state.historicalDefinitions) ? state.historicalDefinitions : [];
    const combined = new Map<string, PreparedDefinition>();
    for (const item of known) {
      const mapping = mapArborAssessment(item.label, item.assessmentDate, item.periodHint);
      if (!mapping) continue;
      for (const yearGroup of item.yearGroups ?? []) {
        const cycle = mapArborAssessmentForYearGroup(mapping, yearGroup);
        if (cycle) combined.set(`${item.id}:${cycle.cycleExternalId}`, item);
      }
    }
    // Take one page from each family in turn. This prevents the large P8
    // catalogue from delaying A-Level or percentage cycle discovery.
    for (let inspected = 0; inspected < MARK_PAGES_PER_RUN && yearCursor < HISTORIC_ACADEMIC_YEARS.length; inspected++) {
      if (HISTORIC_FAMILY_ORDER.every((family) => familyProgress[family]?.complete)) {
        yearCursor++;
        familyCursor = 0;
        familyProgress = {};
        continue;
      }
      const academicYear = HISTORIC_ACADEMIC_YEARS[yearCursor];
      const family = HISTORIC_FAMILY_ORDER[familyCursor % HISTORIC_FAMILY_ORDER.length];
      familyCursor = (familyCursor + 1) % HISTORIC_FAMILY_ORDER.length;
      const progress = familyProgress[family] ?? {};
      if (progress.complete) continue;
      const familyDefinitions = definitionsForFamily(definitions, family);
      const chunks = Array.from({ length: Math.ceil(familyDefinitions.length / DEFINITIONS_PER_QUERY) }, (_, index) => familyDefinitions.slice(index * DEFINITIONS_PER_QUERY, (index + 1) * DEFINITIONS_PER_QUERY));
      const chunk = progress.chunk ?? 0;
      const markPage = progress.markPage ?? 0;
      if (!chunks[chunk]?.length) {
        familyProgress[family] = { ...progress, complete: true };
        continue;
      }
      if (inspected > 0) await pauseForArbor();
      const marks = await client.listAssessmentMarks(500, markPage, chunks[chunk].map((definition) => definition.id), academicYear);
      for (const mark of marks) {
        if (!mark.assessment) continue;
        const label = arborAssessmentLabel(mark.assessment);
        const mapping = mapArborAssessment(label, mark.assessmentDate, mark.displayName);
        if (mapping) addHistoricDefinition(combined, { id: mark.assessment.id, label, assessmentDate: mark.assessmentDate, periodHint: mark.displayName }, mapping, mark.student.displayAcademicLevel?.displayName);
      }
      if (marks.length < 500) {
        const nextChunk = chunk + 1;
        familyProgress[family] = nextChunk >= chunks.length
          ? { chunk: nextChunk, markPage: 0, complete: true }
          : { chunk: nextChunk, markPage: 0 };
      } else {
        familyProgress[family] = { chunk, markPage: markPage + 1 };
      }
    }
    if (yearCursor < HISTORIC_ACADEMIC_YEARS.length && HISTORIC_FAMILY_ORDER.every((family) => familyProgress[family]?.complete)) {
      yearCursor++;
      familyCursor = 0;
      familyProgress = {};
    }
    const historicComplete = yearCursor >= HISTORIC_ACADEMIC_YEARS.length;
    const nextState = {
      ...state,
      definitions,
      historicalDefinitions: [...combined.values()],
      historicYearCursor: yearCursor,
      historicFamilyCursor: familyCursor,
      historicFamilyProgress: familyProgress,
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
