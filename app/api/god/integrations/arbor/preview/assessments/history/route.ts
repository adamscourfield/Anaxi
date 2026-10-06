import { NextResponse } from "next/server";
import { arborConnectionWhere } from "@/lib/integrations/arbor/connectionScope";
import { requireSuperAdminUser } from "@/lib/admin";
import { withApi } from "@/lib/apiRoute";
import { assertCsrfFromForm } from "@/lib/csrf";
import { decryptCredentials } from "@/lib/integrationSecrets";
import { ArborClient } from "@/lib/integrations/arbor/client";
import { arborAssessmentFamily, arborAssessmentLabel, arborHistoricYearGroup, mapArborAssessment, mapArborAssessmentForYearGroup } from "@/lib/integrations/arbor/assessmentPolicy";
import type { ArborCredentials } from "@/lib/integrations/arbor/types";
import { prisma } from "@/lib/prisma";

type PreparedDefinition = { id: string; label: string; assessmentDate?: string | null; periodHint?: string | null; yearGroups?: string[]; source?: "PROGRESS_MARK" | "BATCH_TARGET" | "BATCH" };
type AssessmentSyncState = {
  definitions?: PreparedDefinition[];
  historicalDefinitions?: PreparedDefinition[];
  historicBatchPage?: number;
  historicBatchDefinitionOffset?: number;
  historicComplete?: boolean;
  historicDiscoveryVersion?: number;
};

// v17 reads Arbor's actual mark-sheet targets filtered to the agreed
// assessment definitions. Earlier releases inferred a
// roster from the generic progress-mark stream, which is incomplete for
// historic senior cohorts and can cross-contaminate subject lists.
const HISTORIC_DISCOVERY_VERSION = 17;
const DEFINITIONS_PER_BATCH_QUERY = 20;

function addHistoricDefinition(target: Map<string, PreparedDefinition>, definition: PreparedDefinition, mapping: NonNullable<ReturnType<typeof mapArborAssessment>>, student: { id: string; displayAcademicLevel: { displayName: string } | null; leavingDate: string | null }, archivedYearGroup?: string | null) {
  const inferredYearGroup = arborHistoricYearGroup(student.displayAcademicLevel?.displayName, archivedYearGroup, student.leavingDate, mapping.academicYear, mapping.family);
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
  const integration = await db.sharedIntegration.findFirst({ where: arborConnectionWhere(req), include: { schools: { where: { enabled: true }, select: { tenantId: true } } } });
  if (!integration?.credentialsCiphertext || integration.status !== "CONNECTED") return NextResponse.redirect(new URL("/god/integrations/arbor?assessmentActive=not-connected", req.url));

  try {
    const config = integration.config && typeof integration.config === "object" ? integration.config as Record<string, unknown> : {};
    const savedState = config.assessmentSync && typeof config.assessmentSync === "object" ? config.assessmentSync as AssessmentSyncState : {};
    // Rebuild against real Arbor mark-sheet targets. Cached output from the
    // generic progress-mark reader is deliberately discarded because it can
    // show a pupil in a subject they do not take.
    const state: AssessmentSyncState = savedState.historicComplete || savedState.historicDiscoveryVersion !== HISTORIC_DISCOVERY_VERSION
      ? { ...savedState, historicalDefinitions: [], historicBatchPage: 0, historicBatchDefinitionOffset: 0, historicComplete: false }
      : savedState;
    const client = new ArborClient(decryptCredentials<ArborCredentials>(integration.credentialsCiphertext));
    const archivedStudents = await db.student.findMany({
      where: { tenantId: { in: integration.schools.map((school: { tenantId: string }) => school.tenantId) }, externalId: { not: null }, status: "ARCHIVED" },
      select: { externalId: true, yearGroup: true },
    });
    const archivedYearGroupByExternalId = new Map<string, string | null>(archivedStudents.map((student: { externalId: string | null; yearGroup: string | null }) => [student.externalId!, student.yearGroup]));
    let definitions = Array.isArray(state.definitions)
      ? state.definitions.filter((item): item is PreparedDefinition => typeof item?.id === "string" && typeof item?.label === "string" && Boolean(arborAssessmentFamily(item.label)))
      : [];
    if (!definitions.length) {
      definitions = (await client.listAllAssessmentDefinitions())
        .map((definition) => ({ id: definition.id, label: arborAssessmentLabel(definition) }))
        .filter((definition): definition is PreparedDefinition => Boolean(arborAssessmentFamily(definition.label)))
        .sort((a, b) => a.label.localeCompare(b.label));
    }
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
    const definitionOffset = typeof state.historicBatchDefinitionOffset === "number" && state.historicBatchDefinitionOffset >= 0 ? state.historicBatchDefinitionOffset : 0;
    const definitionSlice = definitions.slice(definitionOffset, definitionOffset + DEFINITIONS_PER_BATCH_QUERY);
    const batchPage = typeof state.historicBatchPage === "number" && state.historicBatchPage >= 0 ? state.historicBatchPage : 0;
    const batches = await client.listProgressAssessmentBatches(100, batchPage, definitionSlice.map((definition) => definition.id));
    let acceptedTargets = 0;
    const rejected = { noAssessment: 0, unsupportedLabel: 0, noPeriod: 0, emptyRoster: 0, noCohort: 0, duplicate: 0 };
    const labelSamples: string[] = [];
    for (const batch of batches) {
      if (!batch.assessment) { rejected.noAssessment++; continue; }
      const label = arborAssessmentLabel(batch.assessment);
      if (labelSamples.length < 3 && !labelSamples.includes(label)) labelSamples.push(label);
      if (!arborAssessmentFamily(label)) { rejected.unsupportedLabel++; continue; }
      const assessmentDate = batch.currentReferenceDate ?? null;
      const mapping = mapArborAssessment(label, assessmentDate, batch.batchName);
      if (!mapping) { rejected.noPeriod++; continue; }
      const definition: PreparedDefinition = { id: batch.id, label, assessmentDate, periodHint: batch.batchName, source: "BATCH" };
      const roster = batch.students;
      if (!roster.length) { rejected.emptyRoster++; continue; }
      const before = combined.size;
      for (const student of roster) addHistoricDefinition(combined, definition, mapping, student, archivedYearGroupByExternalId.get(student.id));
      if (combined.size > before) acceptedTargets++;
      else {
        const hasEligibleCohort = roster.some((student) => Boolean(arborHistoricYearGroup(
          student.displayAcademicLevel?.displayName,
          archivedYearGroupByExternalId.get(student.id),
          student.leavingDate,
          mapping.academicYear,
          mapping.family,
        )));
        if (hasEligibleCohort) rejected.duplicate++;
        else rejected.noCohort++;
      }
    }
    const nextDefinitionOffset = batches.length < 100 ? definitionOffset + DEFINITIONS_PER_BATCH_QUERY : definitionOffset;
    const nextBatchPage = batches.length < 100 ? 0 : batchPage + 1;
    const historicComplete = nextDefinitionOffset >= definitions.length;
    const nextState = {
      ...state,
      definitions,
      historicalDefinitions: [...combined.values()],
      historicBatchPage: nextBatchPage,
      historicBatchDefinitionOffset: nextDefinitionOffset,
      historicComplete,
      historicDiscoveryVersion: HISTORIC_DISCOVERY_VERSION,
    };
    await db.sharedIntegration.update({ where: { id: integration.id }, data: { config: { ...config, assessmentSync: nextState } } });
    const url = new URL("/god/integrations/arbor", req.url);
    url.searchParams.set("assessmentHistory", historicComplete ? "complete" : "progress");
    url.searchParams.set("assessmentHistoryCycles", String(combined.size));
    url.searchParams.set("assessmentHistoryBatches", String(batches.length));
    url.searchParams.set("assessmentHistoryTargets", String(batches.length));
    url.searchParams.set("assessmentHistoryAccepted", String(acceptedTargets));
    url.searchParams.set("assessmentHistoryReasons", `labels: ${labelSamples.join(" / ") || "none"}; no assessment ${rejected.noAssessment}, unsupported ${rejected.unsupportedLabel}, no period ${rejected.noPeriod}, empty roster ${rejected.emptyRoster}, no cohort ${rejected.noCohort}, already found ${rejected.duplicate}`);
    return NextResponse.redirect(url);
  } catch (error) {
    const url = new URL("/god/integrations/arbor", req.url);
    url.searchParams.set("assessmentHistory", "failed");
    url.searchParams.set("assessmentHistoryError", error instanceof Error ? error.message.slice(0, 180) : "Historic cycle discovery failed.");
    return NextResponse.redirect(url);
  }
});
