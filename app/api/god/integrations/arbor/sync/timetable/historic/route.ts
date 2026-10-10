import { NextResponse } from "next/server";
import { requireSuperAdminUser } from "@/lib/admin";
import { withApi } from "@/lib/apiRoute";
import { assertCsrfFromForm } from "@/lib/csrf";
import { arborConnectionWhere } from "@/lib/integrations/arbor/connectionScope";
import { ArborClient } from "@/lib/integrations/arbor/client";
import type { ArborCredentials } from "@/lib/integrations/arbor/types";
import { buildTimetableIdentityResolver } from "@/lib/integrations/arbor/timetableIdentity";
import { decryptCredentials } from "@/lib/integrationSecrets";
import { PLATFORM_TENANT_ID } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

type HistoricSyncState = { page?: number; startedAt?: string; completedAt?: string };
const ACADEMIC_YEAR = "2025/2026";
const AS_OF_DATE = "2026-07-15";
const EFFECTIVE_FROM = new Date("2025-09-01T00:00:00.000Z");
const EFFECTIVE_TO = new Date("2026-08-31T23:59:59.999Z");

/** Imports only dated 2025/26 classroom assignments; current timetable rows are untouched. */
export const POST = withApi(async function POST(req: Request) {
  const actor = await requireSuperAdminUser();
  const form = await req.formData();
  try { await assertCsrfFromForm(form); } catch { return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }); }
  if (form.get("confirm") !== "SYNC_HISTORIC_TIMETABLE") {
    return NextResponse.redirect(new URL("/god/integrations/arbor?timetableHistoricSync=confirmation-required", req.url));
  }

  const db = prisma as any;
  const integration = await db.sharedIntegration.findFirst({
    where: arborConnectionWhere(req),
    include: { schools: { where: { enabled: true }, select: { tenantId: true } } },
  });
  if (!integration?.credentialsCiphertext || integration.status !== "CONNECTED") {
    return NextResponse.redirect(new URL("/god/integrations/arbor?timetableHistoricSync=not-connected", req.url));
  }

  let runId: string | null = null;
  try {
    const config = integration.config && typeof integration.config === "object" ? integration.config as Record<string, unknown> : {};
    const historicSyncs = config.historicTimetableSyncs && typeof config.historicTimetableSyncs === "object" ? config.historicTimetableSyncs as Record<string, HistoricSyncState> : {};
    const state = historicSyncs[ACADEMIC_YEAR] ?? {};
    const page = typeof state.page === "number" && state.page >= 0 ? state.page : 0;
    const startedAt = state.startedAt && !Number.isNaN(new Date(state.startedAt).getTime()) ? new Date(state.startedAt) : new Date();
    const run = await db.sharedIntegrationSyncRun.create({ data: { integrationId: integration.id, entityType: "TIMETABLE", triggeredBy: actor.id } });
    runId = run.id;
    const tenantIds = integration.schools.map((school: { tenantId: string }) => school.tenantId);
    const batch = await new ArborClient(decryptCredentials<ArborCredentials>(integration.credentialsCiphertext)).listHistoricTimetableTeacherAssignmentsBatch(AS_OF_DATE, page);
    const [students, staff] = await Promise.all([
      db.student.findMany({ where: { tenantId: { in: tenantIds } }, select: { id: true, tenantId: true, fullName: true, externalId: true } }),
      db.user.findMany({ where: { tenantId: { in: tenantIds } }, select: { id: true, tenantId: true, fullName: true, externalId: true } }),
    ]);
    const studentResolver = buildTimetableIdentityResolver(students);
    const staffResolver = buildTimetableIdentityResolver(staff);
    const candidates = new Map<string, { tenantId: string; studentId: string; teacherId: string; subject: string; className: string }>();
    for (const assignment of batch.assignments) {
      const matches = studentResolver.studentCandidates(assignment.studentId, assignment.studentName);
      const eligibleStudents = matches.filter((match) => assignment.staff.some((arborStaff) => staffResolver.staff(match.person.tenantId, arborStaff.id, arborStaff.fullName)));
      if (eligibleStudents.length !== 1) continue;
      const student = eligibleStudents[0].person;
      for (const arborStaff of assignment.staff) {
        const teacher = staffResolver.staff(student.tenantId, arborStaff.id, arborStaff.fullName)?.person;
        const subject = assignment.subject.trim();
        if (!teacher || !subject) continue;
        candidates.set(`${student.id}:${teacher.id}:${subject.toLocaleLowerCase()}`, { tenantId: student.tenantId, studentId: student.id, teacherId: teacher.id, subject, className: assignment.className });
      }
    }
    const subjects = new Map<string, { id: string }>();
    for (const item of candidates.values()) {
      const key = `${item.tenantId}:${item.subject.toLocaleLowerCase()}`;
      if (!subjects.has(key)) subjects.set(key, await db.subject.upsert({ where: { tenantId_name: { tenantId: item.tenantId, name: item.subject } }, create: { tenantId: item.tenantId, name: item.subject }, update: { active: true } }));
    }
    const rows = [...candidates.values()].map((item) => ({ tenantId: item.tenantId, studentId: item.studentId, teacherId: item.teacherId, className: item.className, subjectId: subjects.get(`${item.tenantId}:${item.subject.toLocaleLowerCase()}`)!.id, effectiveFrom: EFFECTIVE_FROM, effectiveTo: EFFECTIVE_TO, dataSource: "ARBOR" as const, arborSyncedAt: startedAt }));
    const existing = rows.length ? await db.studentSubjectTeacher.findMany({ where: { tenantId: { in: tenantIds }, dataSource: "ARBOR", effectiveFrom: EFFECTIVE_FROM, studentId: { in: [...new Set(rows.map((row) => row.studentId))] } }, select: { id: true, tenantId: true, studentId: true, subjectId: true, teacherId: true } }) : [];
    const existingKeys = new Map(existing.map((row: { id: string; tenantId: string; studentId: string; subjectId: string; teacherId: string }) => [`${row.tenantId}:${row.studentId}:${row.subjectId}:${row.teacherId}`, row.id]));
    for (const row of rows) {
      const id = existingKeys.get(`${row.tenantId}:${row.studentId}:${row.subjectId}:${row.teacherId}`);
      if (id) await db.studentSubjectTeacher.update({ where: { id }, data: { className: row.className, effectiveTo: EFFECTIVE_TO, arborSyncedAt: startedAt } });
    }
    if (rows.length) await db.studentSubjectTeacher.createMany({ data: rows, skipDuplicates: true });

    const complete = !batch.hasMore;
    if (complete) {
      await db.studentSubjectTeacher.deleteMany({ where: { tenantId: { in: tenantIds }, dataSource: "ARBOR", effectiveFrom: EFFECTIVE_FROM, OR: [{ arborSyncedAt: null }, { arborSyncedAt: { lt: startedAt } }] } });
    }
    const nextState = complete ? { completedAt: new Date().toISOString() } : { page: page + 1, startedAt: startedAt.toISOString() };
    await db.sharedIntegrationSyncRun.update({ where: { id: run.id }, data: { status: "SUCCESS", recordsProcessed: rows.length, recordsCreated: rows.length, finishedAt: new Date() } });
    await db.sharedIntegration.update({ where: { id: integration.id }, data: { config: { ...config, historicTimetableSyncs: { ...historicSyncs, [ACADEMIC_YEAR]: nextState } }, lastSyncedAt: new Date(), lastSyncStatus: "SUCCESS", lastSyncError: null } });
    await db.auditLog.create({ data: { tenantId: PLATFORM_TENANT_ID, actorUserId: actor.id, action: "integration.arbor.historic_timetable_synced", targetType: "SharedIntegration", targetId: integration.id, afterJson: { academicYear: ACADEMIC_YEAR, page, linked: rows.length, complete } } });
    const url = new URL("/god/integrations/arbor", req.url);
    url.searchParams.set("timetableHistoricSync", complete ? "success" : "progress");
    url.searchParams.set("timetableHistoricPage", String(page + 1));
    url.searchParams.set("timetableHistoricLinked", String(rows.length));
    url.searchParams.set("timetableHistoricMemberships", String(batch.diagnostics.memberships));
    url.searchParams.set("timetableHistoricActive", String(batch.diagnostics.activeMemberships));
    url.searchParams.set("timetableHistoricSubjects", String(batch.diagnostics.subjectClasses));
    url.searchParams.set("timetableHistoricTeachers", String(batch.diagnostics.staffedClasses));
    return NextResponse.redirect(url);
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Historic timetable sync failed.";
    if (runId) await db.sharedIntegrationSyncRun.update({ where: { id: runId }, data: { status: "FAILED", recordsFailed: 1, errorSummary: message, finishedAt: new Date() } });
    const url = new URL("/god/integrations/arbor?timetableHistoricSync=failed", req.url);
    url.searchParams.set("timetableError", message);
    return NextResponse.redirect(url);
  }
});
