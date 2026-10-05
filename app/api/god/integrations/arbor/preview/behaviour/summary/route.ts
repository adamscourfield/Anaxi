import { NextResponse } from "next/server";
import { arborConnectionWhere } from "@/lib/integrations/arbor/connectionScope";
import { requireSuperAdminUser } from "@/lib/admin";
import { withApi } from "@/lib/apiRoute";
import { assertCsrfFromForm } from "@/lib/csrf";
import { decryptCredentials } from "@/lib/integrationSecrets";
import { ArborClient } from "@/lib/integrations/arbor/client";
import { summariseBehaviour } from "@/lib/integrations/arbor/behaviourSummary";
import type { ArborCredentials } from "@/lib/integrations/arbor/types";
import { prisma } from "@/lib/prisma";

/** A seven-day, read-only behaviour summary before Anaxi writes any totals. */
export const POST = withApi(async function POST(req: Request) {
  await requireSuperAdminUser();
  const form = await req.formData();
  try { await assertCsrfFromForm(form); } catch { return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }); }
  const db = prisma as any;
  const integration = await db.sharedIntegration.findFirst({ where: arborConnectionWhere(req), include: { schools: { where: { enabled: true }, select: { tenantId: true } } } });
  if (!integration?.credentialsCiphertext || integration.status !== "CONNECTED") return NextResponse.redirect(new URL("/god/integrations/arbor?behaviourPreview=not-connected", req.url));
  try {
    const end = new Date(); const start = new Date(end); start.setDate(start.getDate() - 7);
    const records = await new ArborClient(decryptCredentials<ArborCredentials>(integration.credentialsCiphertext)).listBehaviourRecords(100, 0, start.toISOString().slice(0, 10), end.toISOString().slice(0, 10));
    const inRequestedRange = (value: string | null) => {
      if (!value) return false;
      const date = new Date(value);
      return !Number.isNaN(date.getTime()) && date >= start && date <= end;
    };
    const datesMatch = [
      ...records.PointAward.map((item) => item.awardedDatetime),
      ...records.Detention.map((item) => item.decisionDatetime),
      ...records.InternalExclusion.map((item) => item.issuedDatetime),
      ...records.FixedPeriodExclusion.map((item) => item.fromDatetime),
    ].every(inRequestedRange);
    if (!datesMatch) return NextResponse.redirect(new URL("/god/integrations/arbor?behaviourPreview=range-mismatch", req.url));
    const tenantIds = integration.schools.map((school: { tenantId: string }) => school.tenantId);
    const students: Array<{ externalId: string | null }> = await db.student.findMany({ where: { tenantId: { in: tenantIds }, status: "ACTIVE", dataSource: "ARBOR", externalId: { not: null } }, select: { externalId: true } });
    const linked = new Set(students.flatMap((student) => student.externalId ? [student.externalId] : []));
    const summary = summariseBehaviour(records, linked);
    let points = 0, detentions = 0, internalExclusions = 0, suspensions = 0;
    for (const total of summary.byStudent.values()) { points += total.positivePoints; detentions += total.detentions; internalExclusions += total.internalExclusions; suspensions += total.suspensions; }
    const url = new URL("/god/integrations/arbor", req.url);
    const capped = records.PointAward.length === 100 || records.Detention.length === 100 || records.InternalExclusion.length === 100 || records.FixedPeriodExclusion.length === 100;
    for (const [key, value] of Object.entries({ behaviourPreview: "success", behaviourStudents: summary.byStudent.size, behaviourPoints: points, behaviourDetentions: detentions, behaviourInternalExclusions: internalExclusions, behaviourSuspensions: suspensions, behaviourUnmatched: summary.unmatched, behaviourCapped: capped ? "1" : "0" })) url.searchParams.set(key, String(value));
    return NextResponse.redirect(url);
  } catch { return NextResponse.redirect(new URL("/god/integrations/arbor?behaviourPreview=failed", req.url)); }
});
