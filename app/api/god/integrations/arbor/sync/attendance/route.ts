import { NextResponse } from "next/server";
import { arborConnectionWhere } from "@/lib/integrations/arbor/connectionScope";
import { requireSuperAdminUser } from "@/lib/admin";
import { withApi } from "@/lib/apiRoute";
import { assertCronAuthorized } from "@/lib/cronAuth";
import { assertCsrfFromForm } from "@/lib/csrf";
import { decryptCredentials } from "@/lib/integrationSecrets";
import { ArborClient } from "@/lib/integrations/arbor/client";
import { academicYearStart, addDays, attendancePercentage, dateKey } from "@/lib/integrations/arbor/attendanceSync";
import { summariseAttendance, summariseMorningAttendance } from "@/lib/integrations/arbor/attendanceSummary";
import type { ArborCredentials } from "@/lib/integrations/arbor/types";
import { PLATFORM_TENANT_ID } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

const DAYS_PER_BATCH = 7;

type Totals = { possible: number; present: number; late: number };

function londonYesterday(): Date {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(new Date());
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return addDays(new Date(Date.UTC(value("year"), value("month") - 1, value("day"))), -1);
}

async function updateInChunks(tasks: Array<() => Promise<unknown>>) {
  for (let index = 0; index < tasks.length; index += 100) await Promise.all(tasks.slice(index, index + 100).map((task) => task()));
}

/**
 * Imports a small run of complete calendar days. Only Anaxi's daily aggregates are
 * retained; the individual Arbor register marks are discarded after this request.
 */
export const POST = withApi(async function POST(req: Request) {
  const cronDenied = assertCronAuthorized(req);
  const isScheduledRun = !cronDenied && req.headers.get("x-arbor-scheduled-sync") === "1";
  const actor = isScheduledRun ? null : await requireSuperAdminUser();

  if (!isScheduledRun) {
    const form = await req.formData();
    try { await assertCsrfFromForm(form); } catch { return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }); }
    if (form.get("confirm") !== "SYNC_ATTENDANCE") {
      return NextResponse.redirect(new URL("/god/integrations/arbor?attendanceSync=confirmation-required", req.url));
    }
  }

  const db = prisma as any;
  const integration = await db.sharedIntegration.findFirst({
    where: arborConnectionWhere(req),
    include: { schools: { where: { enabled: true }, select: { tenantId: true } } },
  });
  if (!integration?.credentialsCiphertext || integration.status !== "CONNECTED") {
    return NextResponse.redirect(new URL("/god/integrations/arbor?attendanceSync=not-connected", req.url));
  }

  const tenantIds = integration.schools.map((school: { tenantId: string }) => school.tenantId);
  const end = londonYesterday();
  const startOfYear = academicYearStart(end);
  // Existing Anaxi students can be linked to Arbor without changing their source.
  // Their external ID, not how they were first created, is what makes them eligible.
  const students: Array<{ id: string; tenantId: string; externalId: string }> = await db.student.findMany({
    where: { tenantId: { in: tenantIds }, status: "ACTIVE", externalId: { not: null } },
    select: { id: true, tenantId: true, externalId: true },
  });
  const existingCoverage = await db.studentSnapshot.findMany({
    where: { studentId: { in: students.map((student) => student.id) }, snapshotDate: { gte: startOfYear, lte: end } },
    select: { studentId: true, snapshotDate: true },
  });
  const coveredStudentsByDay = new Map<string, Set<string>>();
  for (const snapshot of existingCoverage) {
    const key = dateKey(new Date(snapshot.snapshotDate));
    const covered = coveredStudentsByDay.get(key) ?? new Set<string>();
    covered.add(snapshot.studentId);
    coveredStudentsByDay.set(key, covered);
  }
  let start: Date | null = null;
  for (let day = startOfYear; day <= end; day = addDays(day, 1)) {
    if ((coveredStudentsByDay.get(dateKey(day))?.size ?? 0) < students.length) {
      start = day;
      break;
    }
  }

  if (!start) {
    if (isScheduledRun) return NextResponse.json({ upToDate: true });
    return NextResponse.redirect(new URL("/god/integrations/arbor?attendanceSync=up-to-date", req.url));
  }
  const batchEnd = addDays(start, DAYS_PER_BATCH - 1) < end ? addDays(start, DAYS_PER_BATCH - 1) : end;

  let runId: string | null = null;
  let created = 0;
  let updated = 0;
  let preservedManual = 0;
  try {
    const run = await db.sharedIntegrationSyncRun.create({
      data: { integrationId: integration.id, entityType: "ATTENDANCE", triggeredBy: isScheduledRun ? "CRON" : actor!.id },
    });
    runId = run.id;
    const studentByExternalId = new Map(students.map((student) => [student.externalId, student]));
    const linkedExternalIds = new Set(studentByExternalId.keys());
    const existingBefore = await db.studentSnapshot.findMany({
      where: { studentId: { in: students.map((student) => student.id) }, dataSource: "ARBOR", countScope: "YEAR_TO_DATE", snapshotDate: { lt: start } },
      orderBy: { snapshotDate: "desc" },
      select: { studentId: true, attendancePossibleCount: true, attendancePresentCount: true, latenessCount: true },
    });
    const totalsByStudent = new Map<string, Totals>();
    for (const snapshot of existingBefore) {
      if (!totalsByStudent.has(snapshot.studentId)) totalsByStudent.set(snapshot.studentId, { possible: snapshot.attendancePossibleCount, present: snapshot.attendancePresentCount, late: snapshot.latenessCount });
    }
    const existing = await db.studentSnapshot.findMany({
      where: { studentId: { in: students.map((student) => student.id) }, snapshotDate: { gte: start, lte: batchEnd } },
      select: { id: true, studentId: true, snapshotDate: true, dataSource: true },
    });
    const existingByKey = new Map<string, { id: string; dataSource: string }>(
      existing.map((snapshot: { id: string; studentId: string; snapshotDate: Date; dataSource: string }) => [
        `${snapshot.studentId}:${dateKey(new Date(snapshot.snapshotDate))}`,
        { id: snapshot.id, dataSource: snapshot.dataSource },
      ]),
    );
    const client = new ArborClient(decryptCredentials<ArborCredentials>(integration.credentialsCiphertext));

    for (let day = start; day <= batchEnd; day = addDays(day, 1)) {
      const nextDay = addDays(day, 1);
      const records = await client.listAllAttendanceRecords(dateKey(day), dateKey(nextDay));
      const daily = summariseAttendance(records, linkedExternalIds).byStudent;
      const morning = summariseMorningAttendance(records, linkedExternalIds).byStudent;
      const creates: Array<Record<string, unknown>> = [];
      const updates: Array<() => Promise<unknown>> = [];
      for (const student of students) {
        const previous = totalsByStudent.get(student.id) ?? { possible: 0, present: 0, late: 0 };
        const today = daily.get(student.externalId) ?? { possible: 0, present: 0, late: 0 };
        const totals = { possible: previous.possible + today.possible, present: previous.present + today.present, late: previous.late + today.late };
        totalsByStudent.set(student.id, totals);
        const key = `${student.id}:${dateKey(day)}`;
        const current = existingByKey.get(key);
        if (current && current.dataSource !== "ARBOR") { preservedManual++; continue; }
        const data = {
          countScope: "YEAR_TO_DATE",
          attendancePct: attendancePercentage(totals),
          attendancePossibleCount: totals.possible,
          attendancePresentCount: totals.present,
          latenessCount: totals.late,
          dataSource: "ARBOR",
        };
        if (current) {
          updates.push(() => db.studentSnapshot.update({ where: { id: current.id }, data }));
          updated++;
        } else {
          creates.push({ tenantId: student.tenantId, studentId: student.id, snapshotDate: day, ...data });
          created++;
        }
      }
      if (creates.length) await db.studentSnapshot.createMany({ data: creates });
      await updateInChunks(updates);

      // Backfill the same completed-day figures used by the home page. This is
      // deliberately calculated from the first register only, so lateness is
      // the morning-registration rate rather than a mixture of AM and PM.
      const dailyTotalsByTenant = new Map<string, Totals>();
      for (const student of students) {
        const attendance = morning.get(student.externalId);
        if (!attendance) continue;
        const totals = dailyTotalsByTenant.get(student.tenantId) ?? { possible: 0, present: 0, late: 0 };
        totals.possible += attendance.possible;
        totals.present += attendance.present;
        totals.late += attendance.late;
        dailyTotalsByTenant.set(student.tenantId, totals);
      }
      await Promise.all([...dailyTotalsByTenant.entries()].map(([tenantId, totals]) =>
        db.dailyAttendanceCheck.upsert({
          where: { tenantId_checkDate: { tenantId, checkDate: day } },
          create: { tenantId, checkDate: day, possibleCount: totals.possible, presentCount: totals.present, lateCount: totals.late },
          update: { possibleCount: totals.possible, presentCount: totals.present, lateCount: totals.late, checkedAt: new Date() },
        })
      ));
    }

    await db.sharedIntegrationSyncRun.update({ where: { id: run.id }, data: { status: "SUCCESS", recordsProcessed: created + updated, recordsCreated: created, recordsUpdated: updated, finishedAt: new Date() } });
    await db.sharedIntegration.update({ where: { id: integration.id }, data: { lastSyncedAt: new Date(), lastSyncStatus: "SUCCESS", lastSyncError: null } });
    if (actor) await db.auditLog.create({ data: { tenantId: PLATFORM_TENANT_ID, actorUserId: actor.id, action: "integration.arbor.attendance_synced", targetType: "SharedIntegration", targetId: integration.id, afterJson: { from: dateKey(start), to: dateKey(batchEnd), created, updated, preservedManual } } });
    if (isScheduledRun) return NextResponse.json({ from: dateKey(start), to: dateKey(batchEnd), created, updated, preservedManual });
    const url = new URL("/god/integrations/arbor", req.url);
    for (const [key, value] of Object.entries({ attendanceSync: "success", attendanceFrom: dateKey(start), attendanceTo: dateKey(batchEnd), attendanceCreated: created, attendanceUpdated: updated, attendancePreserved: preservedManual })) url.searchParams.set(key, String(value));
    return NextResponse.redirect(url);
  } catch (error) {
    const errorSummary = error instanceof Error ? error.message.slice(0, 500) : "Attendance sync failed.";
    if (runId) await db.sharedIntegrationSyncRun.update({ where: { id: runId }, data: { status: created || updated ? "PARTIAL" : "FAILED", recordsProcessed: created + updated, recordsCreated: created, recordsUpdated: updated, recordsFailed: 1, errorSummary, finishedAt: new Date() } });
    await db.sharedIntegration.update({ where: { id: integration.id }, data: { lastSyncStatus: "FAILED", lastSyncError: "Attendance sync did not complete. Check the God Mode audit log." } });
    if (isScheduledRun) return NextResponse.json({ error: errorSummary }, { status: 500 });
    return NextResponse.redirect(new URL("/god/integrations/arbor?attendanceSync=failed", req.url));
  }
});
