import { NextResponse } from "next/server";
import { requireSuperAdminUser } from "@/lib/admin";
import { withApi } from "@/lib/apiRoute";
import { assertCronAuthorized } from "@/lib/cronAuth";
import { assertCsrfFromForm } from "@/lib/csrf";
import { decryptCredentials } from "@/lib/integrationSecrets";
import { ArborClient } from "@/lib/integrations/arbor/client";
import type { ArborCredentials } from "@/lib/integrations/arbor/types";
import { PLATFORM_TENANT_ID } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

function currentAcademicYearStart(): Date {
  const now = new Date();
  const year = now.getUTCMonth() >= 8 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return new Date(Date.UTC(year, 8, 1));
}

/** Replaces only Arbor-owned subject-teacher links with the current teaching groups. */
export const POST = withApi(async function POST(req: Request) {
  const denied = assertCronAuthorized(req);
  const scheduled = !denied && req.headers.get("x-arbor-scheduled-sync") === "1";
  const actor = scheduled ? null : await requireSuperAdminUser();
  if (!scheduled) {
    const form = await req.formData();
    try { await assertCsrfFromForm(form); } catch { return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }); }
    if (form.get("confirm") !== "SYNC_TIMETABLE") return NextResponse.redirect(new URL("/god/integrations/arbor?timetableSync=confirmation-required", req.url));
  }

  const db = prisma as any;
  const integration = await db.sharedIntegration.findUnique({
    where: { provider: "ARBOR" },
    include: { schools: { where: { enabled: true }, select: { tenantId: true } } },
  });
  if (!integration?.credentialsCiphertext || integration.status !== "CONNECTED") {
    return NextResponse.redirect(new URL("/god/integrations/arbor?timetableSync=not-connected", req.url));
  }

  let runId: string | null = null;
  let linked = 0;
  try {
    const run = await db.sharedIntegrationSyncRun.create({
      data: { integrationId: integration.id, entityType: "TIMETABLE", triggeredBy: scheduled ? "CRON" : actor!.id },
    });
    runId = run.id;
    const tenantIds = integration.schools.map((school: { tenantId: string }) => school.tenantId);
    const [assignments, students, staff]: [
      Array<{ studentId: string; teachingGroupId: string; subject: string; staffIds: string[] }>,
      Array<{ id: string; tenantId: string; externalId: string }>,
      Array<{ id: string; tenantId: string; externalId: string }>,
    ] = await Promise.all([
      new ArborClient(decryptCredentials<ArborCredentials>(integration.credentialsCiphertext)).listTimetableTeacherAssignments({ all: true }),
      db.student.findMany({ where: { tenantId: { in: tenantIds }, status: "ACTIVE", externalId: { not: null } }, select: { id: true, tenantId: true, externalId: true } }),
      db.user.findMany({ where: { tenantId: { in: tenantIds }, externalId: { not: null }, isActive: true }, select: { id: true, tenantId: true, externalId: true } }),
    ]);
    if (!assignments.length) throw new Error("Arbor returned no subject-teacher assignments, so existing Arbor links were left unchanged.");

    const studentsByExternalId = new Map<string, { id: string; tenantId: string; externalId: string }>(students.map((student) => [student.externalId, student]));
    const staffByTenantAndExternalId = new Map<string, { id: string; tenantId: string; externalId: string }>(staff.map((user) => [`${user.tenantId}:${user.externalId}`, user]));
    const candidateLinks = new Map<string, { tenantId: string; studentId: string; teacherId: string; subject: string }>();
    for (const assignment of assignments) {
      const student = studentsByExternalId.get(assignment.studentId);
      if (!student) continue;
      for (const staffExternalId of assignment.staffIds) {
        const teacher = staffByTenantAndExternalId.get(`${student.tenantId}:${staffExternalId}`);
        if (!teacher) continue;
        const subject = assignment.subject.trim();
        if (!subject) continue;
        candidateLinks.set(`${student.id}:${teacher.id}:${subject.toLocaleLowerCase()}`, { tenantId: student.tenantId, studentId: student.id, teacherId: teacher.id, subject });
      }
    }
    if (!candidateLinks.size) throw new Error("Arbor returned timetable assignments, but none matched linked Anaxi students and staff. Existing Arbor links were left unchanged.");

    const subjectByTenantAndName = new Map<string, { tenantId: string; name: string }>();
    for (const item of candidateLinks.values()) subjectByTenantAndName.set(`${item.tenantId}:${item.subject.toLocaleLowerCase()}`, { tenantId: item.tenantId, name: item.subject });
    const subjects = new Map<string, { id: string }>();
    for (const [key, item] of subjectByTenantAndName) {
      const subject = await db.subject.upsert({ where: { tenantId_name: { tenantId: item.tenantId, name: item.name } }, create: item, update: { active: true } });
      subjects.set(key, subject);
    }

    const effectiveFrom = currentAcademicYearStart();
    const rows = [...candidateLinks.values()].map((item) => ({
      tenantId: item.tenantId,
      studentId: item.studentId,
      teacherId: item.teacherId,
      subjectId: subjects.get(`${item.tenantId}:${item.subject.toLocaleLowerCase()}`)!.id,
      effectiveFrom,
      dataSource: "ARBOR",
    }));
    await db.$transaction(async (tx: any) => {
      await tx.studentSubjectTeacher.deleteMany({ where: { tenantId: { in: tenantIds }, dataSource: "ARBOR" } });
      await tx.studentSubjectTeacher.createMany({ data: rows, skipDuplicates: true });
    });
    linked = rows.length;

    await db.sharedIntegrationSyncRun.update({ where: { id: run.id }, data: { status: "SUCCESS", recordsProcessed: linked, recordsCreated: linked, finishedAt: new Date() } });
    await db.sharedIntegration.update({ where: { id: integration.id }, data: { lastSyncedAt: new Date(), lastSyncStatus: "SUCCESS", lastSyncError: null } });
    if (actor) await db.auditLog.create({ data: { tenantId: PLATFORM_TENANT_ID, actorUserId: actor.id, action: "integration.arbor.timetable_synced", targetType: "SharedIntegration", targetId: integration.id, afterJson: { assignments: assignments.length, linked } } });
    if (scheduled) return NextResponse.json({ assignments: assignments.length, linked });
    const url = new URL("/god/integrations/arbor", req.url);
    url.searchParams.set("timetableSync", "success");
    url.searchParams.set("timetableAssignments", String(assignments.length));
    url.searchParams.set("timetableLinkable", String(linked));
    return NextResponse.redirect(url);
  } catch (error) {
    const errorSummary = error instanceof Error ? error.message.slice(0, 500) : "Timetable sync failed.";
    if (runId) await db.sharedIntegrationSyncRun.update({ where: { id: runId }, data: { status: "FAILED", recordsFailed: 1, errorSummary, finishedAt: new Date() } });
    if (scheduled) return NextResponse.json({ error: errorSummary }, { status: 500 });
    const url = new URL("/god/integrations/arbor?timetableSync=failed", req.url);
    url.searchParams.set("timetableError", errorSummary);
    return NextResponse.redirect(url);
  }
});
