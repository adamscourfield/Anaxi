import { NextResponse } from "next/server";
import { arborConnectionWhere } from "@/lib/integrations/arbor/connectionScope";
import { requireSuperAdminUser } from "@/lib/admin";
import { withApi } from "@/lib/apiRoute";
import { assertCronAuthorized } from "@/lib/cronAuth";
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
  /** Retained while a newer, read-only discovery pass verifies the same cycles. */
  pendingHistoricalDefinitions?: PreparedDefinition[];
  historicBatchPage?: number;
  historicBatchDefinitionOffset?: number;
  historicComplete?: boolean;
  historicDiscoveryVersion?: number;
};

// v23 reads each batch target's `allStudents` roster and prioritises the
// agreed GCSE/A-Level families before percentage definitions. A parent batch
// can be a whole year cohort; its `students` relationship is not a subject
// mark sheet.
// A rebuild is accumulated separately. Discovery may be temporarily incomplete
// while Arbor paginates batch targets, so it may add or refine review cycles but
// must never remove an existing cycle. God Mode removal is the explicit way to
// hide a cycle an operator does not want to use.
const HISTORIC_DISCOVERY_VERSION = 24;
const DEFINITIONS_PER_BATCH_QUERY = 80;

function historicDefinitionPriority(definition: PreparedDefinition): number {
  const family = arborAssessmentFamily(definition.label);
  return family === "GCSE" ? 0 : family === "A_LEVEL" ? 1 : family === "Y10_PERCENTAGE" ? 2 : 3;
}

function addHistoricDefinition(target: Map<string, PreparedDefinition>, definition: PreparedDefinition, mapping: NonNullable<ReturnType<typeof mapArborAssessment>>, student: { id: string; displayAcademicLevel: { displayName: string } | null; leavingDate: string | null }, archivedYearGroup?: string | null) {
  // P8 GCSE batches are the agreed Year 11 source. Their historic pupils may
  // no longer have a current academic level, so do not let a missing profile
  // field hide the whole GCSE cycle.
  const inferredYearGroup = mapping.family === "GCSE"
    ? "Y11"
    // This is a dedicated Arbor Year 10 definition, unlike the shared KS3
    // percentage family. Current pupils have rolled into Year 11 by the time
    // historic discovery runs, so a live-level inference must not hide the
    // legitimate Year 10 cycle.
    : mapping.family === "Y10_PERCENTAGE"
      ? "Y10"
    : arborHistoricYearGroup(student.displayAcademicLevel?.displayName, archivedYearGroup, student.leavingDate, mapping.academicYear, mapping.family);
  const cycle = inferredYearGroup ? mapArborAssessmentForYearGroup(mapping, inferredYearGroup) : null;
  if (!cycle || !inferredYearGroup) return;
  const key = `${definition.id}:${cycle.cycleExternalId}`;
  const existing = target.get(key);
  target.set(key, { ...definition, yearGroups: [...new Set([...(existing?.yearGroups ?? []), inferredYearGroup])] });
}

export const POST = withApi(async function POST(req: Request) {
  const cronDenied = assertCronAuthorized(req);
  const scheduled = !cronDenied && req.headers.get("x-arbor-scheduled-sync") === "1";
  if (!scheduled) {
    await requireSuperAdminUser();
    const form = await req.formData();
    try { await assertCsrfFromForm(form); } catch {
      const url = new URL("/god/integrations/arbor", req.url);
      const connectionId = new URL(req.url).searchParams.get("connectionId");
      if (connectionId) url.searchParams.set("connectionId", connectionId);
      url.searchParams.set("csrf", "expired");
      return NextResponse.redirect(url);
    }
  }
  const db = prisma as any;
  const integration = await db.sharedIntegration.findFirst({ where: arborConnectionWhere(req), include: { schools: { where: { enabled: true }, select: { tenantId: true } } } });
  if (!integration?.credentialsCiphertext || integration.status !== "CONNECTED") return NextResponse.redirect(new URL("/god/integrations/arbor?assessmentActive=not-connected", req.url));

  try {
    const config = integration.config && typeof integration.config === "object" ? integration.config as Record<string, unknown> : {};
    const savedState = config.assessmentSync && typeof config.assessmentSync === "object" ? config.assessmentSync as AssessmentSyncState : {};
    // Rebuild against real Arbor mark-sheet targets without clearing the
    // visible review list. A manual recheck is read-only and must never make
    // Autumn/Year 11 cycles disappear while later pages are still loading.
    const state: AssessmentSyncState = savedState.historicComplete || savedState.historicDiscoveryVersion !== HISTORIC_DISCOVERY_VERSION
      ? {
        ...savedState,
        // Do not use the previous visible result as discovery input. It may
        // contain pupils that have since moved up an academic year.
        pendingHistoricalDefinitions: [],
        historicBatchPage: 0,
        historicBatchDefinitionOffset: 0,
        historicComplete: false,
      }
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
        .sort((a, b) => historicDefinitionPriority(a) - historicDefinitionPriority(b) || a.label.localeCompare(b.label));
    }
    // Existing connections may already have an alphabetically prepared queue.
    // Reorder that queue as well so the next safe request reaches the agreed
    // GCSE and A-Level subjects before optional percentage assessments.
    definitions = [...definitions].sort((a, b) => historicDefinitionPriority(a) - historicDefinitionPriority(b) || a.label.localeCompare(b.label));
    // Seed the working catalogue from both the in-progress scan and the last
    // published result. Arbor can omit a batch from one recheck response; that
    // must not make a previously reviewable cycle disappear from God Mode.
    const known = [
      ...(Array.isArray(savedState.historicalDefinitions) ? savedState.historicalDefinitions : []),
      ...(Array.isArray(state.pendingHistoricalDefinitions) ? state.pendingHistoricalDefinitions : []),
    ];
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
    const targets = await client.listProgressAssessmentBatchTargets(batches.map((batch) => batch.id));
    const targetsByBatchId = new Map<string, typeof targets>();
    for (const target of targets) {
      const batchId = target.progressAssessmentBatch?.id;
      if (!batchId) continue;
      const items = targetsByBatchId.get(batchId) ?? [];
      items.push(target);
      targetsByBatchId.set(batchId, items);
    }
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
      // `allStudents` expands the target's actual pupils. Do not fall back to
      // the parent batch roster: that represents the wider cohort and produces
      // pupils on subjects they do not study.
      const roster = [...new Map(
        (targetsByBatchId.get(batch.id) ?? []).flatMap((target) => target.allStudents).map((student) => [student.id, student]),
      ).values()];
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
      // Publish the merged catalogue only after every prepared definition has
      // been checked. Existing cycles are deliberately retained.
      historicalDefinitions: historicComplete ? [...combined.values()] : savedState.historicalDefinitions,
      historicBatchPage: nextBatchPage,
      historicBatchDefinitionOffset: nextDefinitionOffset,
      historicComplete,
      historicDiscoveryVersion: HISTORIC_DISCOVERY_VERSION,
      pendingHistoricalDefinitions: historicComplete ? undefined : [...combined.values()],
    };
    await db.sharedIntegration.update({ where: { id: integration.id }, data: { config: { ...config, assessmentSync: nextState } } });
    const url = new URL("/god/integrations/arbor", req.url);
    url.searchParams.set("assessmentHistory", historicComplete ? "complete" : "progress");
    url.searchParams.set("assessmentHistoryCycles", String(combined.size));
    url.searchParams.set("assessmentHistoryBatches", String(batches.length));
    url.searchParams.set("assessmentHistoryTargets", String(batches.length));
    url.searchParams.set("assessmentHistoryAccepted", String(acceptedTargets));
    url.searchParams.set("assessmentHistoryReasons", `labels: ${labelSamples.join(" / ") || "none"}; no assessment ${rejected.noAssessment}, unsupported ${rejected.unsupportedLabel}, no period ${rejected.noPeriod}, empty roster ${rejected.emptyRoster}, no cohort ${rejected.noCohort}, already found ${rejected.duplicate}`);
    if (scheduled) return NextResponse.json({ cycles: combined.size, batches: batches.length, accepted: acceptedTargets, complete: historicComplete });
    return NextResponse.redirect(url);
  } catch (error) {
    if (scheduled) return NextResponse.json({ error: error instanceof Error ? error.message.slice(0, 180) : "Historic cycle discovery failed." }, { status: 500 });
    const url = new URL("/god/integrations/arbor", req.url);
    url.searchParams.set("assessmentHistory", "failed");
    url.searchParams.set("assessmentHistoryError", error instanceof Error ? error.message.slice(0, 180) : "Historic cycle discovery failed.");
    return NextResponse.redirect(url);
  }
});
