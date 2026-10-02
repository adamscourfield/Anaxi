import { NextResponse } from "next/server";
import { requireSuperAdminUser } from "@/lib/admin";
import { withApi } from "@/lib/apiRoute";
import { assertCsrfFromForm } from "@/lib/csrf";
import { decryptCredentials } from "@/lib/integrationSecrets";
import { ArborClient } from "@/lib/integrations/arbor/client";
import { summariseAttendance } from "@/lib/integrations/arbor/attendanceSummary";
import type { ArborCredentials } from "@/lib/integrations/arbor/types";
import { prisma } from "@/lib/prisma";

export const POST = withApi(async function POST(req: Request) {
  await requireSuperAdminUser(); const form = await req.formData();
  try { await assertCsrfFromForm(form); } catch { return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }); }
  const db = prisma as any; const integration = await db.sharedIntegration.findUnique({ where: { provider: "ARBOR" }, include: { schools: { where: { enabled: true }, select: { tenantId: true } } } });
  if (!integration?.credentialsCiphertext || integration.status !== "CONNECTED") return NextResponse.redirect(new URL("/god/integrations/arbor?attendancePreview=not-connected", req.url));
  try {
    const end = new Date(); const start = new Date(end); start.setDate(start.getDate() - 7);
    const client = new ArborClient(decryptCredentials<ArborCredentials>(integration.credentialsCiphertext));
    // Arbor's documented filters accept calendar dates; a smaller page avoids a
    // large register response while this remains a read-only preview.
    const records = await client.listAttendanceRecords(100, 0, start.toISOString().slice(0, 10), end.toISOString().slice(0, 10));
    const tenantIds = integration.schools.map((school: { tenantId: string }) => school.tenantId);
    const linkedStudents: Array<{ externalId: string | null }> = await db.student.findMany({ where: { tenantId: { in: tenantIds }, dataSource: "ARBOR", externalId: { not: null } }, select: { externalId: true } });
    const linked = new Set<string>(linkedStudents.flatMap((student) => student.externalId ? [student.externalId] : []));
    const summary = summariseAttendance(records, linked); let possible = 0, present = 0, late = 0;
    for (const item of summary.byStudent.values()) { possible += item.possible; present += item.present; late += item.late; }
    const url = new URL("/god/integrations/arbor", req.url); for (const [key, value] of Object.entries({ attendancePreview: "success", attendanceRecords: records.length, attendanceStudents: summary.byStudent.size, attendancePct: possible ? Math.round((present / possible) * 1000) / 10 : 0, attendanceLate: late, attendanceUnmatched: summary.unmatched })) url.searchParams.set(key, String(value)); return NextResponse.redirect(url);
  } catch { return NextResponse.redirect(new URL("/god/integrations/arbor?attendancePreview=failed", req.url)); }
});
