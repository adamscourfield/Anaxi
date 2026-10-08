import { NextResponse } from "next/server";
import { arborConnectionWhere } from "@/lib/integrations/arbor/connectionScope";
import { assertCronAuthorized } from "@/lib/cronAuth";
import { decryptCredentials } from "@/lib/integrationSecrets";
import { ArborClient } from "@/lib/integrations/arbor/client";
import { addDays, dateKey } from "@/lib/integrations/arbor/attendanceSync";
import { summariseMorningAttendance } from "@/lib/integrations/arbor/attendanceSummary";
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
 * directly from Arbor. GitHub Actions may delay a scheduled call, so the sync
 * always reads each pupil's first register of the day and backfills yesterday
 * too. That preserves a reliable morning-registration measure at any run time.
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
  const daysToCheck = [addDays(today, -1), today];

  const students: Array<{ id: string; tenantId: string; externalId: string }> = await db.student.findMany({
    where: { tenantId: { in: tenantIds }, status: "ACTIVE", externalId: { not: null } },
    select: { id: true, tenantId: true, externalId: true },
  });
  if (students.length === 0) return NextResponse.json({ skipped: "no linked students" });

  try {
    const linkedExternalIds = new Set(students.map((student) => student.externalId));
    const client = new ArborClient(decryptCredentials<ArborCredentials>(integration.credentialsCiphertext));
    const completedDates: string[] = [];

    for (const checkDate of daysToCheck) {
      const records = await client.listAllAttendanceRecords(dateKey(checkDate), dateKey(addDays(checkDate, 1)));
      const byStudent = summariseMorningAttendance(records, linkedExternalIds).byStudent;
      const totalsByTenant = new Map<string, { possible: number; present: number; late: number }>();
      for (const student of students) {
        const daily = byStudent.get(student.externalId);
        if (!daily) continue;
        const totals = totalsByTenant.get(student.tenantId) ?? { possible: 0, present: 0, late: 0 };
        totals.possible += daily.possible;
        totals.present += daily.present;
        totals.late += daily.late;
        totalsByTenant.set(student.tenantId, totals);
      }

      for (const tenantId of tenantIds) {
        const totals = totalsByTenant.get(tenantId);
        if (!totals || totals.possible === 0) continue;
        await db.dailyAttendanceCheck.upsert({
          where: { tenantId_checkDate: { tenantId, checkDate } },
          create: { tenantId, checkDate, possibleCount: totals.possible, presentCount: totals.present, lateCount: totals.late },
          update: { possibleCount: totals.possible, presentCount: totals.present, lateCount: totals.late, checkedAt: new Date() },
        });
      }
      completedDates.push(dateKey(checkDate));
    }

    return NextResponse.json({ dates: completedDates, tenants: tenantIds.length });
  } catch (error) {
    const errorSummary = error instanceof Error ? error.message.slice(0, 500) : "Morning attendance check failed.";
    return NextResponse.json({ error: errorSummary }, { status: 500 });
  }
});
