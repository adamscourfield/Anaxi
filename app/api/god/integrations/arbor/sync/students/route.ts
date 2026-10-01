import { NextResponse } from "next/server";
import { requireSuperAdminUser } from "@/lib/admin";
import { withApi } from "@/lib/apiRoute";
import { assertCsrfFromForm } from "@/lib/csrf";
import { decryptCredentials } from "@/lib/integrationSecrets";
import { ArborClient } from "@/lib/integrations/arbor/client";
import { arborYearGroupCode } from "@/lib/integrations/arbor/studentRouting";
import { arborStudentFullName, buildStudentSyncPlan } from "@/lib/integrations/arbor/studentSyncPlan";
import type { ArborCredentials } from "@/lib/integrations/arbor/types";
import { PLATFORM_TENANT_ID } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

export const POST = withApi(async function POST(req: Request) {
  const actor = await requireSuperAdminUser();
  const form = await req.formData();
  try {
    await assertCsrfFromForm(form);
  } catch {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }
  if (form.get("confirm") !== "SYNC_STUDENTS") {
    return NextResponse.redirect(new URL("/god/integrations/arbor?sync=confirmation-required", req.url));
  }

  const db = prisma as any;
  const integration = await db.sharedIntegration.findUnique({
    where: { provider: "ARBOR" },
    include: { schools: { where: { enabled: true }, include: { tenant: { include: { tenantSettings: true } } } } },
  });
  if (!integration?.credentialsCiphertext || integration.status !== "CONNECTED") {
    return NextResponse.redirect(new URL("/god/integrations/arbor?sync=not-connected", req.url));
  }

  const tenantIdBySchoolType: { PRIMARY?: string; SECONDARY?: string } = {};
  for (const school of integration.schools) {
    const schoolType = school.tenant.tenantSettings?.schoolType;
    if (schoolType === "PRIMARY") tenantIdBySchoolType.PRIMARY = school.tenantId;
    if (schoolType === "SECONDARY") tenantIdBySchoolType.SECONDARY = school.tenantId;
  }

  let runId: string | null = null;
  let created = 0;
  let updated = 0;
  let adopted = 0;

  try {
    const run = await db.sharedIntegrationSyncRun.create({
      data: { integrationId: integration.id, entityType: "STUDENTS", triggeredBy: actor.id },
    });
    runId = run.id;
    const tenantIds = Object.values(tenantIdBySchoolType);
    const [arborStudents, existingStudents] = await Promise.all([
      new ArborClient(decryptCredentials<ArborCredentials>(integration.credentialsCiphertext)).listAllStudents(),
      db.student.findMany({
        where: { tenantId: { in: tenantIds } },
        select: { id: true, tenantId: true, fullName: true, yearGroup: true, status: true, externalId: true, dataSource: true },
      }),
    ]);
    const plan = buildStudentSyncPlan(arborStudents, tenantIdBySchoolType, existingStudents);
    if (plan.some((item) => item.action === "REVIEW")) {
      throw new Error("Student routing or matching changed since the comparison. Run the comparison again before syncing.");
    }

    for (const item of plan) {
      if (item.action === "SKIP") continue;
      const yearGroup = arborYearGroupCode(item.arborStudent.displayAcademicLevel?.displayName);
      if (!item.tenantId || !yearGroup) throw new Error("A student could not be routed safely.");
      const data = {
        fullName: arborStudentFullName(item.arborStudent),
        yearGroup,
        status: "ACTIVE",
        externalId: item.arborStudent.id,
        dataSource: "ARBOR",
      };

      if (item.action === "CREATE") {
        const student = await db.student.create({ data: { tenantId: item.tenantId, ...data } });
        await db.sharedIntegrationSyncChange.create({
          data: { syncRunId: run.id, tenantId: item.tenantId, entityType: "Student", entityId: student.id, changeType: "CREATE", afterJson: data },
        });
        created++;
      } else {
        const before = item.existingStudent;
        if (!before) throw new Error("Student sync plan lost its existing record.");
        const student = await db.student.update({ where: { id: before.id }, data });
        await db.sharedIntegrationSyncChange.create({
          data: { syncRunId: run.id, tenantId: item.tenantId, entityType: "Student", entityId: student.id, changeType: "UPDATE", beforeJson: before, afterJson: data },
        });
        updated++;
        if (item.action === "ADOPT") adopted++;
      }
    }

    await db.sharedIntegrationSyncRun.update({
      where: { id: run.id },
      data: { status: "SUCCESS", recordsProcessed: created + updated, recordsCreated: created, recordsUpdated: updated, finishedAt: new Date() },
    });
    await db.sharedIntegration.update({ where: { id: integration.id }, data: { lastSyncedAt: new Date(), lastSyncStatus: "SUCCESS", lastSyncError: null } });
    await db.auditLog.create({
      data: { tenantId: PLATFORM_TENANT_ID, actorUserId: actor.id, action: "integration.arbor.students_synced", targetType: "SharedIntegration", targetId: integration.id, afterJson: { created, updated, adopted } },
    });
    const url = new URL("/god/integrations/arbor", req.url);
    url.searchParams.set("sync", "success");
    url.searchParams.set("created", String(created));
    url.searchParams.set("adopted", String(adopted));
    return NextResponse.redirect(url);
  } catch (error) {
    const errorSummary = error instanceof Error ? error.message.slice(0, 500) : "Student sync failed.";
    if (runId) {
      await db.sharedIntegrationSyncRun.update({
        where: { id: runId },
        data: { status: created || updated ? "PARTIAL" : "FAILED", recordsProcessed: created + updated, recordsCreated: created, recordsUpdated: updated, recordsFailed: 1, errorSummary, finishedAt: new Date() },
      });
    }
    await db.sharedIntegration.update({ where: { id: integration.id }, data: { lastSyncStatus: "FAILED", lastSyncError: "Student sync did not complete. Check the God Mode audit log." } });
    const reason = errorSummary.includes("SharedIntegrationSyncRun") ? "migration-required" : "failed";
    return NextResponse.redirect(new URL(`/god/integrations/arbor?sync=${reason}`, req.url));
  }
});
