import { NextResponse } from "next/server";
import { requireSuperAdminUser } from "@/lib/admin";
import { withApi } from "@/lib/apiRoute";
import { assertCsrfFromForm } from "@/lib/csrf";
import { arborConnectionWhere } from "@/lib/integrations/arbor/connectionScope";
import { ArborClient } from "@/lib/integrations/arbor/client";
import type { ArborCredentials } from "@/lib/integrations/arbor/types";
import { decryptCredentials } from "@/lib/integrationSecrets";
import { prisma } from "@/lib/prisma";

const ACADEMIC_YEAR = "2025/2026";
const AS_OF_DATE = "2026-07-15";

/** Calculates Arbor's real roster endpoint without importing any records. */
export const POST = withApi(async function POST(req: Request) {
  await requireSuperAdminUser();
  const form = await req.formData();
  try { await assertCsrfFromForm(form); } catch { return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }); }
  const db = prisma as any;
  const integration = await db.sharedIntegration.findFirst({ where: arborConnectionWhere(req) });
  if (!integration?.credentialsCiphertext || integration.status !== "CONNECTED") return NextResponse.redirect(new URL("/god/integrations/arbor?timetableHistoricProgress=not-connected", req.url));
  try {
    const count = await new ArborClient(decryptCredentials<ArborCredentials>(integration.credentialsCiphertext)).countHistoricTimetableRoster(AS_OF_DATE);
    const config = integration.config && typeof integration.config === "object" ? integration.config as Record<string, unknown> : {};
    const syncs = config.historicTimetableSyncs && typeof config.historicTimetableSyncs === "object" ? config.historicTimetableSyncs as Record<string, Record<string, unknown>> : {};
    await db.sharedIntegration.update({ where: { id: integration.id }, data: { config: { ...config, historicTimetableSyncs: { ...syncs, [ACADEMIC_YEAR]: { ...syncs[ACADEMIC_YEAR], totalMemberships: count.memberships, totalPages: count.pages, countedAt: new Date().toISOString() } } } } });
    const url = new URL("/god/integrations/arbor", req.url);
    url.searchParams.set("timetableHistoricProgress", "success");
    url.searchParams.set("timetableHistoricTotal", String(count.memberships));
    url.searchParams.set("timetableHistoricTotalPages", String(count.pages));
    url.searchParams.set("connectionId", integration.id);
    return NextResponse.redirect(url);
  } catch (error) {
    const url = new URL("/god/integrations/arbor", req.url);
    url.searchParams.set("timetableHistoricProgress", "failed");
    url.searchParams.set("timetableError", error instanceof Error ? error.message.slice(0, 500) : "Historic roster progress check failed.");
    return NextResponse.redirect(url);
  }
});
