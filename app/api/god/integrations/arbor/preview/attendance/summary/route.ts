import { NextResponse } from "next/server";
import { requireSuperAdminUser } from "@/lib/admin";
import { withApi } from "@/lib/apiRoute";
import { assertCsrfFromForm } from "@/lib/csrf";
import { decryptCredentials } from "@/lib/integrationSecrets";
import { ArborClient } from "@/lib/integrations/arbor/client";
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
    const records = await client.listAttendanceRecords(500, 0, start.toISOString(), end.toISOString());
    const tenantIds = integration.schools.map((school: { tenantId: string }) => school.tenantId);
    const linked = new Set((await db.student.findMany({ where: { tenantId: { in: tenantIds }, dataSource: "ARBOR", externalId: { not: null } }, select: { externalId: true } })).map((student: { externalId: string }) => student.externalId));
    const students = new Set<string>(); let possible = 0, present = 0, late = 0, unmatched = 0;
    for (const record of records) { if (record.isRedundant || !record.attendanceMark) continue; if (!linked.has(record.student.id)) { unmatched++; continue; } students.add(record.student.id); if (record.attendanceMark.isStatisticalPossibleAttendance) { possible++; if (record.attendanceMark.isStatisticalPresent) present++; } if (record.minutesLate || record.attendanceMark.isDefaultLate) late++; }
    const url = new URL("/god/integrations/arbor", req.url); for (const [key, value] of Object.entries({ attendancePreview: "success", attendanceRecords: records.length, attendanceStudents: students.size, attendancePct: possible ? Math.round((present / possible) * 1000) / 10 : 0, attendanceLate: late, attendanceUnmatched: unmatched })) url.searchParams.set(key, String(value)); return NextResponse.redirect(url);
  } catch { return NextResponse.redirect(new URL("/god/integrations/arbor?attendancePreview=failed", req.url)); }
});
