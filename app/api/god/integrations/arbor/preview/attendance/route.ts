import { NextResponse } from "next/server";
import { arborConnectionWhere } from "@/lib/integrations/arbor/connectionScope";
import { requireSuperAdminUser } from "@/lib/admin";
import { withApi } from "@/lib/apiRoute";
import { assertCsrfFromForm } from "@/lib/csrf";
import { decryptCredentials } from "@/lib/integrationSecrets";
import { ArborClient } from "@/lib/integrations/arbor/client";
import type { ArborCredentials } from "@/lib/integrations/arbor/types";
import { prisma } from "@/lib/prisma";

export const POST = withApi(async function POST(req: Request) {
  await requireSuperAdminUser();
  const form = await req.formData();
  try { await assertCsrfFromForm(form); } catch { return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }); }
  const integration = await (prisma as any).sharedIntegration.findFirst({ where: arborConnectionWhere(req) });
  if (!integration?.credentialsCiphertext || integration.status !== "CONNECTED") return NextResponse.redirect(new URL("/god/integrations/arbor?attendance=not-connected", req.url));
  try {
    const records = await new ArborClient(decryptCredentials<ArborCredentials>(integration.credentialsCiphertext)).listAttendanceRecords();
    const url = new URL("/god/integrations/arbor", req.url); url.searchParams.set("attendance", "success"); url.searchParams.set("attendanceRecords", String(records.length));
    return NextResponse.redirect(url);
  } catch { return NextResponse.redirect(new URL("/god/integrations/arbor?attendance=failed", req.url)); }
});
