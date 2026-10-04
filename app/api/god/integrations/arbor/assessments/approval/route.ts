import { NextResponse } from "next/server";
import { requireSuperAdminUser } from "@/lib/admin";
import { withApi } from "@/lib/apiRoute";
import { PLATFORM_TENANT_ID } from "@/lib/constants";
import { assertCsrfFromForm } from "@/lib/csrf";
import { mapArborAssessment, mapArborAssessmentForYearGroup } from "@/lib/integrations/arbor/assessmentPolicy";
import { prisma } from "@/lib/prisma";

type PreparedDefinition = { id: string; label: string; assessmentDate?: string | null };
type AssessmentSyncState = { definitions?: PreparedDefinition[]; historicalDefinitions?: PreparedDefinition[] };

function proposedCycleKeys(config: Record<string, unknown>): Set<string> {
  const state = config.assessmentSync && typeof config.assessmentSync === "object"
    ? config.assessmentSync as AssessmentSyncState
    : {};
  const definitions = [state.definitions, state.historicalDefinitions].flatMap((items) => Array.isArray(items)
    ? items.filter((item): item is PreparedDefinition => typeof item?.id === "string" && typeof item?.label === "string")
    : []);
  const keys = new Set<string>();
  for (const definition of definitions) {
    const mapping = mapArborAssessment(definition.label, definition.assessmentDate);
    if (!mapping) continue;
    for (const yearGroup of mapping.yearGroups) {
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
  const integration = await db.sharedIntegration.findUnique({ where: { provider: "ARBOR" } });
  if (!integration) return NextResponse.redirect(new URL("/god/integrations/arbor?assessmentApproval=not-connected", req.url));

  const config = integration.config && typeof integration.config === "object" ? integration.config as Record<string, unknown> : {};
  const availableKeys = proposedCycleKeys(config);
  const pausing = form.get("action") === "pause";
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
