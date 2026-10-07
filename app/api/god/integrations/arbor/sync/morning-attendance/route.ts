import { NextResponse } from "next/server";
import { arborConnectionWhere } from "@/lib/integrations/arbor/connectionScope";
import { assertCronAuthorized } from "@/lib/cronAuth";
import { decryptCredentials } from "@/lib/integrationSecrets";
import { ArborClient } from "@/lib/integrations/arbor/client";
import { addDays, dateKey } from "@/lib/integrations/arbor/attendanceSync";
import { summariseAttendance } from "@/lib/integrations/arbor/attendanceSummary";
import type { ArborCredentials } from "@/lib/integrations/arbor/types";
import { prisma } from "@/lib/prisma";
import { withApi } from "@/lib/apiRoute";

function londonToday(): Date {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(new Date());
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return new Date(Date.UTC(value("year"), value("month") - 1, value("day")));
}

/**
 * Captures a school-wide "in by morning registration" figure for today, read
 * live from Arbor rather than waiting for the overnight cumulative sync (which
 * always lags a day behind). Run once around 10am London time: at that point
 * Arbor has only published the AM register for today, so every attendance
 * record returned for today's date already represents that register, with no
 * need to separate AM from PM.
 */
export const POST = withApi(async function POST(req: Request) {
  const cronDenied = assertCronAuthorized(req);
  if (cronDenied) return cronDenied;

  const db = prisma as any;
  const integration = await db.sharedIntegration.findFirst({
    where: arborConnectionWhere(req),
    include: { schools: { where: { enabled: true }, select: { tenantId: true } } },
  });
  if (!integration?.credentialsCiphertext || integration.status !== "CONNECTED") {
    return NextResponse.json({ error: "not-connected" }, { status: 409 });
  }

  const tenantIds = integration.schools.map((school: { tenantId: string }) => school.tenantId);
  const today = londonToday();
  const tomorrow = addDays(today, 1);

  const students: Array<{ id: string; tenantId: string; externalId: string }> = await db.student.findMany({
    where: { tenantId: { in: tenantIds }, status: "ACTIVE", externalId: { not: null } },
    select: { id: true, tenantId: true, externalId: true },
  });
  if (students.length === 0) return NextResponse.json({ skipped: "no linked students" });

  try {
    const client = new ArborClient(decryptCredentials<ArborCredentials>(integration.credentialsCiphertext));
    const records = await client.listAllAttendanceRecords(dateKey(today), dateKey(tomorrow));
    const linkedExternalIds = new Set(students.map((student) => student.externalId));
    const byStudent = summariseAttendance(records, linkedExternalIds).byStudent;

    const totalsByTenant = new Map<string, { possible: number; present: number }>();
    for (const student of students) {
      const daily = byStudent.get(student.externalId);
      if (!daily) continue;
      const totals = totalsByTenant.get(student.tenantId) ?? { possible: 0, present: 0 };
      totals.possible += daily.possible;
      totals.present += daily.present;
      totalsByTenant.set(student.tenantId, totals);
    }

    for (const tenantId of tenantIds) {
      const totals = totalsByTenant.get(tenantId);
      if (!totals || totals.possible === 0) continue;
      await db.dailyAttendanceCheck.upsert({
        where: { tenantId_checkDate: { tenantId, checkDate: today } },
        create: { tenantId, checkDate: today, possibleCount: totals.possible, presentCount: totals.present },
        update: { possibleCount: totals.possible, presentCount: totals.present, checkedAt: new Date() },
      });
    }

    return NextResponse.json({ date: dateKey(today), tenants: [...totalsByTenant.keys()].length });
  } catch (error) {
    const errorSummary = error instanceof Error ? error.message.slice(0, 500) : "Morning attendance check failed.";
    return NextResponse.json({ error: errorSummary }, { status: 500 });
  }
});
