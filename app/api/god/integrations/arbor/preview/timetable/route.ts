import { NextResponse } from "next/server";
import { arborConnectionWhere } from "@/lib/integrations/arbor/connectionScope";
import { requireSuperAdminUser } from "@/lib/admin";
import { withApi } from "@/lib/apiRoute";
import { assertCsrfFromForm } from "@/lib/csrf";
import { decryptCredentials } from "@/lib/integrationSecrets";
import { ArborClient } from "@/lib/integrations/arbor/client";
import type { ArborCredentials } from "@/lib/integrations/arbor/types";
import { prisma } from "@/lib/prisma";

/** Confirms the exact Arbor relations used for student-subject-teacher links. */
export const POST = withApi(async function POST(req: Request) {
  await requireSuperAdminUser();
  const form = await req.formData();
  try { await assertCsrfFromForm(form); } catch { return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }); }
  const integration = await (prisma as any).sharedIntegration.findFirst({ where: arborConnectionWhere(req) });
  if (!integration?.credentialsCiphertext || integration.status !== "CONNECTED") return NextResponse.redirect(new URL("/god/integrations/arbor?timetable=not-connected", req.url));
  try {
    const fields = await new ArborClient(decryptCredentials<ArborCredentials>(integration.credentialsCiphertext)).inspectTimetableMappingFields();
    const url = new URL("/god/integrations/arbor", req.url);
    url.searchParams.set("timetable", "success");
    url.searchParams.set("timetableFields", Object.entries(fields).map(([entity, names]) => `${entity}: ${names.join(", ") || "none"}`).join(" | ").slice(0, 1800));
    return NextResponse.redirect(url);
  } catch {
    return NextResponse.redirect(new URL("/god/integrations/arbor?timetable=failed", req.url));
  }
});
