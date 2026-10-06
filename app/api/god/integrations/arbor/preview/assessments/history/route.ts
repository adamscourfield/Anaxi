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

type PreparedDefinition = { id: string; label: string; assessmentDate?: string | null; periodHint?: string | null; yearGroups?: string[]; source?: "PROGRESS_MARK" | "BATCH_TARGET" };
type AssessmentSyncState = {
  definitions?: PreparedDefinition[];
  historicalDefinitions?: PreparedDefinition[];
  historicBatchPage?: number;
  historicComplete?: boolean;
  historicDiscoveryVersion?: number;
};

// v16 reads Arbor's actual mark-sheet targets. Earlier releases inferred a
// roster from the generic progress-mark stream, which is incomplete for
// historic senior cohorts and can cross-contaminate subject lists.
const HISTORIC_DISCOVERY_VERSION = 16;

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
      ? { ...savedState, historicalDefinitions: [], historicBatchPage: 0, historicComplete: false }
      : savedState;
    const client = new ArborClient(decryptCredentials<ArborCredentials>(integration.credentialsCiphertext));
    const archivedStudents = await db.student.findMany({
      where: { tenantId: { in: integration.schools.map((school: { tenantId: string }) => school.tenantId) }, externalId: { not: null }, status: "ARCHIVED" },
      select: { externalId: true, yearGroup: true },
    });
    const archivedYearGroupByExternalId = new Map<string, string | null>(archivedStudents.map((student: { externalId: string | null; yearGroup: string | null }) => [student.externalId!, student.yearGroup]));
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
    const batchPage = typeof state.historicBatchPage === "number" && state.historicBatchPage >= 0 ? state.historicBatchPage : 0;
    const batches = await client.listProgressAssessmentBatches(50, batchPage);
    const targets = await client.listProgressAssessmentBatchTargets(batches.map((batch) => batch.id));
    let acceptedTargets = 0;
    for (const target of targets) {
      const batch = target.progressAssessmentBatch;
      if (!batch?.assessment) continue;
      const label = arborAssessmentLabel(batch.assessment);
      if (!arborAssessmentFamily(label)) continue;
      const assessmentDate = batch.currentReferenceDate ?? target.studentProgressAssessmentMarks.find((mark) => mark.assessmentDate)?.assessmentDate ?? null;
      const mapping = mapArborAssessment(label, assessmentDate, batch.batchName ?? target.displayName);
      if (!mapping) continue;
      const definition: PreparedDefinition = { id: target.id, label, assessmentDate, periodHint: batch.batchName ?? target.displayName, source: "BATCH_TARGET" };
      const roster = target.students.length ? target.students : target.studentProgressAssessmentMarks.map((mark) => mark.student);
      const before = combined.size;
      for (const student of roster) addHistoricDefinition(combined, definition, mapping, student, archivedYearGroupByExternalId.get(student.id));
      if (combined.size > before) acceptedTargets++;
    }
    const historicComplete = batches.length < 50;
    const nextState = {
      ...state,
      historicalDefinitions: [...combined.values()],
      historicBatchPage: historicComplete ? batchPage : batchPage + 1,
      historicComplete,
      historicDiscoveryVersion: HISTORIC_DISCOVERY_VERSION,
    };
    await db.sharedIntegration.update({ where: { id: integration.id }, data: { config: { ...config, assessmentSync: nextState } } });
    const url = new URL("/god/integrations/arbor", req.url);
    url.searchParams.set("assessmentHistory", historicComplete ? "complete" : "progress");
    url.searchParams.set("assessmentHistoryCycles", String(combined.size));
    url.searchParams.set("assessmentHistoryBatches", String(batches.length));
    url.searchParams.set("assessmentHistoryTargets", String(targets.length));
    url.searchParams.set("assessmentHistoryAccepted", String(acceptedTargets));
    return NextResponse.redirect(url);
  } catch (error) {
    const url = new URL("/god/integrations/arbor", req.url);
    url.searchParams.set("assessmentHistory", "failed");
    url.searchParams.set("assessmentHistoryError", error instanceof Error ? error.message.slice(0, 180) : "Historic cycle discovery failed.");
    return NextResponse.redirect(url);
  }
});
