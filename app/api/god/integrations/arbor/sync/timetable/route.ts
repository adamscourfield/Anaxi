import { NextResponse } from "next/server";
import { arborConnectionWhere } from "@/lib/integrations/arbor/connectionScope";
import { requireSuperAdminUser } from "@/lib/admin";
import { withApi } from "@/lib/apiRoute";
import { assertCronAuthorized } from "@/lib/cronAuth";
import { assertCsrfFromForm } from "@/lib/csrf";
import { decryptCredentials } from "@/lib/integrationSecrets";
import { ArborClient } from "@/lib/integrations/arbor/client";
import type { ArborCredentials } from "@/lib/integrations/arbor/types";
import { buildTimetableIdentityResolver } from "@/lib/integrations/arbor/timetableIdentity";
import { PLATFORM_TENANT_ID } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

type TimetableSyncState = { page?: number; startedAt?: string; completedAt?: string };

function currentAcademicYearStart(): Date {
  const now = new Date();
  const year = now.getUTCMonth() >= 8 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return new Date(Date.UTC(year, 8, 1));
}

/** Processes one Arbor roster page so a large school timetable never exceeds function limits. */
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
  const integration = await db.sharedIntegration.findFirst({
    where: arborConnectionWhere(req),
    include: { schools: { where: { enabled: true }, select: { tenantId: true } } },
  });
  if (!integration?.credentialsCiphertext || integration.status !== "CONNECTED") {
    return NextResponse.redirect(new URL("/god/integrations/arbor?timetableSync=not-connected", req.url));
  }

  let runId: string | null = null;
  let linked = 0;
  try {
    const config = integration.config && typeof integration.config === "object" ? integration.config as Record<string, unknown> : {};
    const storedState = config.timetableSync && typeof config.timetableSync === "object" ? config.timetableSync as TimetableSyncState : {};
    const page = typeof storedState.page === "number" && storedState.page >= 0 ? storedState.page : 0;
    const startedAt = storedState.startedAt && !Number.isNaN(new Date(storedState.startedAt).getTime()) ? new Date(storedState.startedAt) : new Date();
    const run = await db.sharedIntegrationSyncRun.create({
      data: { integrationId: integration.id, entityType: "TIMETABLE", triggeredBy: scheduled ? "CRON" : actor!.id },
    });
    runId = run.id;
    const tenantIds = integration.schools.map((school: { tenantId: string }) => school.tenantId);
    const batch = await new ArborClient(decryptCredentials<ArborCredentials>(integration.credentialsCiphertext)).listTimetableTeacherAssignmentsBatch(page);
    const [students, staff] = await Promise.all([
      db.student.findMany({ where: { tenantId: { in: tenantIds }, status: "ACTIVE" }, select: { id: true, tenantId: true, fullName: true, externalId: true } }),
      db.user.findMany({ where: { tenantId: { in: tenantIds }, isActive: true }, select: { id: true, tenantId: true, fullName: true, externalId: true } }),
    ]);
    const studentResolver = buildTimetableIdentityResolver(students);
    const staffResolver = buildTimetableIdentityResolver(staff);
    let linkedByExternalId = 0;
    let linkedByUniqueName = 0;
    const candidates = new Map<string, { tenantId: string; studentId: string; teacherId: string; subject: string }>();
    for (const assignment of batch.assignments) {
      const studentMatch = studentResolver.student(assignment.studentId, assignment.studentName);
      if (!studentMatch) continue;
      const student = studentMatch.person;
      for (const arborStaff of assignment.staff) {
        const teacherMatch = staffResolver.staff(student.tenantId, arborStaff.id, arborStaff.fullName);
        const teacher = teacherMatch?.person;
        const subject = assignment.subject.trim();
        if (!teacher || !subject) continue;
        if (studentMatch.method === "EXTERNAL_ID" && teacherMatch.method === "EXTERNAL_ID") linkedByExternalId++;
        else linkedByUniqueName++;
        candidates.set(`${student.id}:${teacher.id}:${subject.toLocaleLowerCase()}`, { tenantId: student.tenantId, studentId: student.id, teacherId: teacher.id, subject });
      }
    }

    const subjects = new Map<string, { id: string }>();
    for (const item of candidates.values()) {
      const key = `${item.tenantId}:${item.subject.toLocaleLowerCase()}`;
      if (subjects.has(key)) continue;
      const subject = await db.subject.upsert({ where: { tenantId_name: { tenantId: item.tenantId, name: item.subject } }, create: { tenantId: item.tenantId, name: item.subject }, update: { active: true } });
      subjects.set(key, subject);
    }

    const effectiveFrom = currentAcademicYearStart();
    const rows = [...candidates.values()].map((item) => ({
      tenantId: item.tenantId,
      studentId: item.studentId,
      teacherId: item.teacherId,
      subjectId: subjects.get(`${item.tenantId}:${item.subject.toLocaleLowerCase()}`)!.id,
      effectiveFrom,
      dataSource: "ARBOR",
      arborSyncedAt: startedAt,
    }));
    const existing = rows.length ? await db.studentSubjectTeacher.findMany({
      where: { tenantId: { in: tenantIds }, dataSource: "ARBOR", studentId: { in: [...new Set(rows.map((row) => row.studentId))] }, effectiveFrom },
      select: { id: true, tenantId: true, studentId: true, subjectId: true, teacherId: true },
    }) : [];
    const existingKeys = new Map((existing as Array<{ id: string; tenantId: string; studentId: string; subjectId: string; teacherId: string }>).map((row) => [`${row.tenantId}:${row.studentId}:${row.subjectId}:${row.teacherId}`, row.id]));
    for (const row of rows) {
      const existingId = existingKeys.get(`${row.tenantId}:${row.studentId}:${row.subjectId}:${row.teacherId}`);
      if (existingId) await db.studentSubjectTeacher.update({ where: { id: existingId }, data: { arborSyncedAt: startedAt } });
    }
    if (rows.length) await db.studentSubjectTeacher.createMany({ data: rows, skipDuplicates: true });
    linked = rows.length;

    const complete = !batch.hasMore;
    if (complete) {
      await db.studentSubjectTeacher.deleteMany({
        where: { tenantId: { in: tenantIds }, dataSource: "ARBOR", OR: [{ arborSyncedAt: null }, { arborSyncedAt: { lt: startedAt } }] },
      });
    }
    await db.sharedIntegrationSyncRun.update({ where: { id: run.id }, data: { status: "SUCCESS", recordsProcessed: linked, recordsCreated: linked, finishedAt: new Date() } });
    await db.sharedIntegration.update({
      where: { id: integration.id },
      data: { config: { ...config, timetableSync: complete ? { completedAt: new Date().toISOString() } : { page: page + 1, startedAt: startedAt.toISOString() } }, lastSyncedAt: new Date(), lastSyncStatus: "SUCCESS", lastSyncError: null },
    });
    if (actor) await db.auditLog.create({ data: { tenantId: PLATFORM_TENANT_ID, actorUserId: actor.id, action: "integration.arbor.timetable_synced", targetType: "SharedIntegration", targetId: integration.id, afterJson: { page, assignments: batch.assignments.length, linked, linkedByExternalId, linkedByUniqueName, complete } } });
    if (scheduled) return NextResponse.json({ page, assignments: batch.assignments.length, linked, linkedByExternalId, linkedByUniqueName, complete });
    const url = new URL("/god/integrations/arbor", req.url);
    url.searchParams.set("timetableSync", complete ? "success" : "progress");
    url.searchParams.set("timetablePage", String(page + 1));
    url.searchParams.set("timetableAssignments", String(batch.assignments.length));
    url.searchParams.set("timetableLinkable", String(linked));
    url.searchParams.set("timetableLinkedById", String(linkedByExternalId));
    url.searchParams.set("timetableLinkedByName", String(linkedByUniqueName));
    url.searchParams.set("timetableMemberships", String(batch.diagnostics.memberships));
    url.searchParams.set("timetableSubjects", String(batch.diagnostics.groupsWithSubjects));
    url.searchParams.set("timetableTeachers", String(batch.diagnostics.groupsWithTeachers));
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
