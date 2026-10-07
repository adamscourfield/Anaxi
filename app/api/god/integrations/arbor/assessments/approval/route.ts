import { NextResponse } from "next/server";
import { arborConnectionWhere } from "@/lib/integrations/arbor/connectionScope";
import { requireSuperAdminUser } from "@/lib/admin";
import { withApi } from "@/lib/apiRoute";
import { PLATFORM_TENANT_ID } from "@/lib/constants";
import { assertCsrfFromForm } from "@/lib/csrf";
import { mapArborAssessment, mapArborAssessmentForYearGroup } from "@/lib/integrations/arbor/assessmentPolicy";
import { prisma } from "@/lib/prisma";

type PreparedDefinition = { id: string; label: string; assessmentDate?: string | null; periodHint?: string | null; yearGroups?: string[] };
type AssessmentSyncState = { definitions?: PreparedDefinition[]; historicalDefinitions?: PreparedDefinition[]; historicComplete?: boolean; historicImportedDefinitionIds?: string[]; historicImportCursor?: number };

function proposedCycleKeys(config: Record<string, unknown>): Set<string> {
  const state = config.assessmentSync && typeof config.assessmentSync === "object"
    ? config.assessmentSync as AssessmentSyncState
    : {};
  const definitions = Array.isArray(state.historicalDefinitions)
    ? state.historicalDefinitions.filter((item): item is PreparedDefinition => typeof item?.id === "string" && typeof item?.label === "string")
    : [];
  const keys = new Set<string>();
  for (const definition of definitions) {
    const mapping = mapArborAssessment(definition.label, definition.assessmentDate, definition.periodHint);
    if (!mapping) continue;
    for (const yearGroup of definition.yearGroups?.length ? definition.yearGroups : mapping.yearGroups) {
      const cycle = mapArborAssessmentForYearGroup(mapping, yearGroup);
      if (cycle) keys.add(cycle.cycleExternalId);
    }
  }
  return keys;
}

export const POST = withApi(async function POST(req: Request) {
  const actor = await requireSuperAdminUser();
  const form = await req.formData();
  try {
    await assertCsrfFromForm(form);
  } catch {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const db = prisma as any;
  const integration = await db.sharedIntegration.findFirst({ where: arborConnectionWhere(req) });
  if (!integration) return NextResponse.redirect(new URL("/god/integrations/arbor?assessmentApproval=not-connected", req.url));

  const config = integration.config && typeof integration.config === "object" ? integration.config as Record<string, unknown> : {};
  const state = config.assessmentSync && typeof config.assessmentSync === "object"
    ? config.assessmentSync as AssessmentSyncState
    : {};
  const availableKeys = proposedCycleKeys(config);
  const deleteCycleKey = form.get("deleteCycleKey");
  const existingApprovedKeys = Array.isArray(config.assessmentApprovedCycleKeys)
    ? config.assessmentApprovedCycleKeys.filter((key): key is string => typeof key === "string")
    : [];
  if (typeof deleteCycleKey === "string" && availableKeys.has(deleteCycleKey)) {
    const excludedCycleKeys = new Set(
      Array.isArray(config.assessmentExcludedCycleKeys)
        ? config.assessmentExcludedCycleKeys.filter((key): key is string => typeof key === "string")
        : [],
    );
    excludedCycleKeys.add(deleteCycleKey);
    const approvedCycleKeys = existingApprovedKeys.filter((key) => key !== deleteCycleKey);
    await db.sharedIntegration.update({
      where: { id: integration.id },
      data: {
        config: {
          ...config,
          assessmentImportApproved: approvedCycleKeys.length > 0,
          assessmentApprovedCycleKeys: approvedCycleKeys,
          assessmentExcludedCycleKeys: [...excludedCycleKeys],
          assessmentApprovalUpdatedAt: new Date().toISOString(),
        },
      },
    });
    await db.auditLog.create({
      data: {
        tenantId: PLATFORM_TENANT_ID,
        actorUserId: actor.id,
        action: "integration.arbor.assessment_cycle_deleted",
        targetType: "SharedIntegration",
        targetId: integration.id,
        afterJson: { deletedCycleKey: deleteCycleKey },
      },
    });
    const url = new URL("/god/integrations/arbor", req.url);
    const connectionId = new URL(req.url).searchParams.get("connectionId");
    if (connectionId) url.searchParams.set("connectionId", connectionId);
    url.searchParams.set("assessmentApproval", "deleted");
    return NextResponse.redirect(url);
  }
  const pausing = form.get("action") === "pause";
  // Operators may approve a reviewed cycle while discovery continues for
  // other definitions. The importer is scoped to the selected reviewed batch,
  // so an unfinished scan cannot add unreviewed subjects to that cycle.
  const requestedKeys = pausing ? [] : form.getAll("cycleKey").filter((value): value is string => typeof value === "string");
  const approvedCycleKeys = [...new Set(requestedKeys.filter((key) => availableKeys.has(key)))];

  await db.sharedIntegration.update({
    where: { id: integration.id },
    data: {
      config: {
        ...config,
        assessmentImportApproved: approvedCycleKeys.length > 0,
        assessmentApprovedCycleKeys: approvedCycleKeys,
        assessmentApprovalUpdatedAt: new Date().toISOString(),
        // An updated approval selection is a fresh import plan. Start its
        // reviewed definitions again so newly approved cycles are not skipped.
        assessmentSync: { ...state, historicImportedDefinitionIds: [], historicImportCursor: 0 },
      },
    },
  });
  await db.auditLog.create({
    data: {
      tenantId: PLATFORM_TENANT_ID,
      actorUserId: actor.id,
      action: pausing ? "integration.arbor.assessment_import_paused" : "integration.arbor.assessment_cycles_approved",
      targetType: "SharedIntegration",
      targetId: integration.id,
      afterJson: { approvedCycleKeys },
    },
  });

  const url = new URL("/god/integrations/arbor", req.url);
  url.searchParams.set("assessmentApproval", pausing ? "paused" : "success");
  url.searchParams.set("assessmentApproved", String(approvedCycleKeys.length));
  return NextResponse.redirect(url);
});
