import { NextResponse } from "next/server";
import { requireSuperAdminUser } from "@/lib/admin";
import { withApi } from "@/lib/apiRoute";
import { assertCronAuthorized } from "@/lib/cronAuth";
import { assertCsrfFromForm } from "@/lib/csrf";
import { decryptCredentials } from "@/lib/integrationSecrets";
import { ArborClient } from "@/lib/integrations/arbor/client";
import { academicYearStart, addDays, dateKey } from "@/lib/integrations/arbor/attendanceSync";
import { summariseBehaviour } from "@/lib/integrations/arbor/behaviourSummary";
import type { ArborCredentials } from "@/lib/integrations/arbor/types";
import { PLATFORM_TENANT_ID } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

const DAYS_PER_BATCH = 7;

function londonYesterday(): Date {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value);
  return addDays(new Date(Date.UTC(part("year"), part("month") - 1, part("day"))), -1);
}

async function updateInChunks(tasks: Array<() => Promise<unknown>>) {
  for (let index = 0; index < tasks.length; index += 100) await Promise.all(tasks.slice(index, index + 100).map((task) => task()));
}

/** Stores only Anaxi's cumulative behaviour measures, never individual Arbor incidents. */
export const POST = withApi(async function POST(req: Request) {
  const denied = assertCronAuthorized(req);
  const scheduled = !denied && req.headers.get("x-arbor-scheduled-sync") === "1";
  const actor = scheduled ? null : await requireSuperAdminUser();
  if (!scheduled) {
    const form = await req.formData();
    try { await assertCsrfFromForm(form); } catch { return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }); }
    if (form.get("confirm") !== "SYNC_BEHAVIOUR") return NextResponse.redirect(new URL("/god/integrations/arbor?behaviourSync=confirmation-required", req.url));
  }
  const db = prisma as any;
  const integration = await db.sharedIntegration.findUnique({ where: { provider: "ARBOR" }, include: { schools: { where: { enabled: true }, select: { tenantId: true } } } });
  if (!integration?.credentialsCiphertext || integration.status !== "CONNECTED") return NextResponse.redirect(new URL("/god/integrations/arbor?behaviourSync=not-connected", req.url));
  const end = londonYesterday(); const academicStart = academicYearStart(end);
  const config = integration.config && typeof integration.config === "object" ? integration.config as Record<string, unknown> : {};
  const storedDate = typeof config.behaviourLastSyncedDate === "string" ? new Date(config.behaviourLastSyncedDate) : null;
  const start = storedDate && !Number.isNaN(storedDate.getTime()) && storedDate >= academicStart ? addDays(storedDate, 1) : academicStart;
  if (start > end) return scheduled ? NextResponse.json({ upToDate: true }) : NextResponse.redirect(new URL("/god/integrations/arbor?behaviourSync=up-to-date", req.url));
  const batchEnd = addDays(start, DAYS_PER_BATCH - 1) < end ? addDays(start, DAYS_PER_BATCH - 1) : end;
  let runId: string | null = null, created = 0, updated = 0, preservedManual = 0;
  try {
    const run = await db.sharedIntegrationSyncRun.create({ data: { integrationId: integration.id, entityType: "BEHAVIOUR", triggeredBy: scheduled ? "CRON" : actor!.id } }); runId = run.id;
    const tenantIds = integration.schools.map((school: { tenantId: string }) => school.tenantId);
    const students: Array<{ id: string; tenantId: string; externalId: string }> = await db.student.findMany({ where: { tenantId: { in: tenantIds }, status: "ACTIVE", dataSource: "ARBOR", externalId: { not: null } }, select: { id: true, tenantId: true, externalId: true } });
    const externalIds = new Set(students.map((student) => student.externalId));
    const existing = await db.studentSnapshot.findMany({ where: { studentId: { in: students.map((student) => student.id) }, snapshotDate: { gte: start, lte: batchEnd } }, select: { id: true, studentId: true, snapshotDate: true, dataSource: true } });
    const existingByKey = new Map<string, { id: string; dataSource: string }>(existing.map((snapshot: { id: string; studentId: string; snapshotDate: Date; dataSource: string }) => [`${snapshot.studentId}:${dateKey(snapshot.snapshotDate)}`, { id: snapshot.id, dataSource: snapshot.dataSource }]));
    const before = await db.studentSnapshot.findMany({ where: { studentId: { in: students.map((student) => student.id) }, dataSource: "ARBOR", snapshotDate: { lt: start } }, orderBy: { snapshotDate: "desc" }, select: { studentId: true, positivePointsTotal: true, detentionsCount: true, internalExclusionsCount: true, suspensionsCount: true } });
    const totals = new Map<string, { points: number; detentions: number; internalExclusions: number; suspensions: number }>();
    for (const snapshot of before) if (!totals.has(snapshot.studentId)) totals.set(snapshot.studentId, { points: snapshot.positivePointsTotal, detentions: snapshot.detentionsCount, internalExclusions: snapshot.internalExclusionsCount, suspensions: snapshot.suspensionsCount });
    const client = new ArborClient(decryptCredentials<ArborCredentials>(integration.credentialsCiphertext));
    for (let day = start; day <= batchEnd; day = addDays(day, 1)) {
      const summary = summariseBehaviour(await client.listAllBehaviourRecords(dateKey(day), dateKey(addDays(day, 1))), externalIds).byStudent;
      const creates: Array<Record<string, unknown>> = []; const updates: Array<() => Promise<unknown>> = [];
      for (const student of students) {
        const previous = totals.get(student.id) ?? { points: 0, detentions: 0, internalExclusions: 0, suspensions: 0 };
        const today = summary.get(student.externalId) ?? { positivePoints: 0, detentions: 0, internalExclusions: 0, suspensions: 0 };
        const next = { points: previous.points + today.positivePoints, detentions: previous.detentions + today.detentions, internalExclusions: previous.internalExclusions + today.internalExclusions, suspensions: previous.suspensions + today.suspensions }; totals.set(student.id, next);
        const current = existingByKey.get(`${student.id}:${dateKey(day)}`); if (current && current.dataSource !== "ARBOR") { preservedManual++; continue; }
        const data = { countScope: "YEAR_TO_DATE", positivePointsTotal: next.points, detentionsCount: next.detentions, internalExclusionsCount: next.internalExclusions, suspensionsCount: next.suspensions, dataSource: "ARBOR" };
        if (current) { updates.push(() => db.studentSnapshot.update({ where: { id: current.id }, data })); updated++; } else { creates.push({ tenantId: student.tenantId, studentId: student.id, snapshotDate: day, ...data }); created++; }
      }
      if (creates.length) await db.studentSnapshot.createMany({ data: creates }); await updateInChunks(updates);
    }
    await db.sharedIntegrationSyncRun.update({ where: { id: run.id }, data: { status: "SUCCESS", recordsProcessed: created + updated, recordsCreated: created, recordsUpdated: updated, finishedAt: new Date() } });
    await db.sharedIntegration.update({ where: { id: integration.id }, data: { config: { ...config, behaviourLastSyncedDate: dateKey(batchEnd) }, lastSyncedAt: new Date(), lastSyncStatus: "SUCCESS", lastSyncError: null } });
    if (actor) await db.auditLog.create({ data: { tenantId: PLATFORM_TENANT_ID, actorUserId: actor.id, action: "integration.arbor.behaviour_synced", targetType: "SharedIntegration", targetId: integration.id, afterJson: { from: dateKey(start), to: dateKey(batchEnd), created, updated, preservedManual } } });
    if (scheduled) return NextResponse.json({ from: dateKey(start), to: dateKey(batchEnd), created, updated });
    const url = new URL("/god/integrations/arbor", req.url); for (const [key, value] of Object.entries({ behaviourSync: "success", behaviourFrom: dateKey(start), behaviourTo: dateKey(batchEnd), behaviourCreated: created, behaviourUpdated: updated, behaviourPreserved: preservedManual })) url.searchParams.set(key, String(value)); return NextResponse.redirect(url);
  } catch (error) {
    const errorSummary = error instanceof Error ? error.message.slice(0, 500) : "Behaviour sync failed.";
    if (runId) await db.sharedIntegrationSyncRun.update({ where: { id: runId }, data: { status: created || updated ? "PARTIAL" : "FAILED", recordsProcessed: created + updated, recordsCreated: created, recordsUpdated: updated, recordsFailed: 1, errorSummary, finishedAt: new Date() } });
    if (scheduled) return NextResponse.json({ error: errorSummary }, { status: 500 }); return NextResponse.redirect(new URL("/god/integrations/arbor?behaviourSync=failed", req.url));
  }
});
