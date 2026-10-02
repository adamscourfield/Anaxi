import { NextResponse } from "next/server";
import { assertCronAuthorized } from "@/lib/cronAuth";
import { decryptCredentials } from "@/lib/integrationSecrets";
import { ArborClient } from "@/lib/integrations/arbor/client";
import type { ArborCredentials } from "@/lib/integrations/arbor/types";
import { prisma } from "@/lib/prisma";

type PreparedDefinition = { id: string; label: string };
type AssessmentSyncState = { definitions?: PreparedDefinition[]; cursor?: number; inspected?: number; matchedMarks?: number };

/** Inspects one approved definition per call to prevent rate-limit bursts. */
export async function POST(req: Request) {
  const denied = assertCronAuthorized(req);
  if (denied) return denied;
  const db = prisma as any;
  const integration = await db.sharedIntegration.findUnique({ where: { provider: "ARBOR" } });
  if (!integration?.credentialsCiphertext || integration.status !== "CONNECTED") return NextResponse.json({ skipped: "not connected" });

  const config = integration.config && typeof integration.config === "object" ? integration.config as Record<string, unknown> : {};
  const state = config.assessmentSync && typeof config.assessmentSync === "object" ? config.assessmentSync as AssessmentSyncState : {};
  const definitions = Array.isArray(state.definitions) ? state.definitions.filter((item): item is PreparedDefinition => typeof item?.id === "string" && typeof item?.label === "string") : [];
  if (!definitions.length) return NextResponse.json({ skipped: "assessment catalogue has not been prepared" });

  const cursor = typeof state.cursor === "number" && state.cursor >= 0 ? state.cursor % definitions.length : 0;
  const definition = definitions[cursor];
  try {
    const client = new ArborClient(decryptCredentials<ArborCredentials>(integration.credentialsCiphertext));
    const marks = await client.listAssessmentMarks(25, 0, [definition.id]);
    await db.sharedIntegration.update({
      where: { id: integration.id },
      data: { config: { ...config, assessmentSync: { ...state, definitions, cursor: (cursor + 1) % definitions.length, inspected: (typeof state.inspected === "number" ? state.inspected : 0) + 1, matchedMarks: (typeof state.matchedMarks === "number" ? state.matchedMarks : 0) + marks.length, lastInspected: { label: definition.label, marks: marks.length, at: new Date().toISOString() } } } },
    });
    return NextResponse.json({ inspected: definition.label, marks: marks.length });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 300) : "Assessment inspection failed.";
    await db.sharedIntegration.update({ where: { id: integration.id }, data: { lastSyncStatus: "PARTIAL", lastSyncError: message } });
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
