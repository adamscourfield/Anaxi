import { NextResponse } from "next/server";
import { requireSuperAdminUser } from "@/lib/admin";
import { withApi } from "@/lib/apiRoute";
import { assertCsrfFromForm } from "@/lib/csrf";
import { arborConnectionWhere } from "@/lib/integrations/arbor/connectionScope";
import { ArborClient } from "@/lib/integrations/arbor/client";
import type { ArborCredentials } from "@/lib/integrations/arbor/types";
import { decryptCredentials } from "@/lib/integrationSecrets";
import { prisma } from "@/lib/prisma";

// This is a proof-of-data check for the last completed academic year, not an import.
export const POST = withApi(async function POST(req: Request) {
  await requireSuperAdminUser();
  const form = await req.formData();
  try { await assertCsrfFromForm(form); } catch { return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }); }

  const integration = await (prisma as any).sharedIntegration.findFirst({ where: arborConnectionWhere(req) });
  if (!integration?.credentialsCiphertext || integration.status !== "CONNECTED") {
    return NextResponse.redirect(new URL("/god/integrations/arbor?timetableHistoric=not-connected", req.url));
  }

  try {
    const asOfDate = "2026-07-15";
    const preview = await new ArborClient(decryptCredentials<ArborCredentials>(integration.credentialsCiphertext)).previewHistoricTimetableRoster(asOfDate);
    const url = new URL("/god/integrations/arbor", req.url);
    url.searchParams.set("timetableHistoric", "success");
    url.searchParams.set("timetableHistoricDate", asOfDate);
    url.searchParams.set("timetableHistoricAssignments", String(preview.assignments.length));
    url.searchParams.set("timetableHistoricMemberships", String(preview.diagnostics.memberships));
    url.searchParams.set("timetableHistoricActive", String(preview.diagnostics.activeMemberships));
    url.searchParams.set("timetableHistoricClasses", String(preview.diagnostics.classes));
    url.searchParams.set("timetableHistoricSubjects", String(preview.diagnostics.subjectClasses));
    url.searchParams.set("timetableHistoricTeachers", String(preview.diagnostics.staffedClasses));
    url.searchParams.set("timetableHistoricSamples", preview.diagnostics.sampleClasses.join("; ").slice(0, 700));
    url.searchParams.set("connectionId", integration.id);
    return NextResponse.redirect(url);
  } catch (error) {
    const url = new URL("/god/integrations/arbor", req.url);
    url.searchParams.set("timetableHistoric", "failed");
    url.searchParams.set("timetableError", error instanceof Error ? error.message.slice(0, 500) : "Historic roster preview failed.");
    return NextResponse.redirect(url);
  }
});
