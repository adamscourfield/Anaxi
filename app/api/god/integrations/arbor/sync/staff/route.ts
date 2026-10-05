import { NextResponse } from "next/server";
import { arborConnectionWhere } from "@/lib/integrations/arbor/connectionScope";
import { requireSuperAdminUser } from "@/lib/admin";
import { withApi } from "@/lib/apiRoute";
import { assertCronAuthorized } from "@/lib/cronAuth";
import { assertCsrfFromForm } from "@/lib/csrf";
import { decryptCredentials } from "@/lib/integrationSecrets";
import { ArborClient } from "@/lib/integrations/arbor/client";
import { arborStaffFullName, buildStaffSyncPlan } from "@/lib/integrations/arbor/staffSyncPlan";
import type { ArborCredentials } from "@/lib/integrations/arbor/types";
import { PLATFORM_TENANT_ID } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

export const POST = withApi(async function POST(req: Request) {
  const cronDenied = assertCronAuthorized(req);
  const isScheduledRun = !cronDenied && req.headers.get("x-arbor-scheduled-sync") === "1";
  const actor = isScheduledRun ? null : await requireSuperAdminUser();

  if (!isScheduledRun) {
    const form = await req.formData();
    try {
      await assertCsrfFromForm(form);
    } catch {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
    }
    if (form.get("confirm") !== "SYNC_STAFF") {
      return NextResponse.redirect(new URL("/god/integrations/arbor?staffSync=confirmation-required", req.url));
    }
  }

  const db = prisma as any;
  const integration = await db.sharedIntegration.findFirst({
    where: arborConnectionWhere(req),
    include: { schools: { where: { enabled: true } } },
  });
  if (!integration?.credentialsCiphertext || integration.status !== "CONNECTED") {
    return NextResponse.redirect(new URL("/god/integrations/arbor?staffSync=not-connected", req.url));
  }

  let linked = 0;
  let updated = 0;
  let runId: string | null = null;
  try {
    const run = await db.sharedIntegrationSyncRun.create({
      data: { integrationId: integration.id, entityType: "STAFF", triggeredBy: isScheduledRun ? "CRON" : actor!.id },
    });
    runId = run.id;
    const tenantIds = integration.schools.map((school: { tenantId: string }) => school.tenantId);
    const [arborStaff, users] = await Promise.all([
      new ArborClient(decryptCredentials<ArborCredentials>(integration.credentialsCiphertext)).listAllStaff(),
      db.user.findMany({
        where: { tenantId: { in: tenantIds } },
        select: { id: true, tenantId: true, fullName: true, externalId: true, dataSource: true },
      }),
    ]);
    const plan = buildStaffSyncPlan(arborStaff, tenantIds, users);
    if (!isScheduledRun && plan.some((item) => item.action === "REVIEW")) {
      throw new Error("Staff matching changed since the comparison. Run the comparison again before syncing.");
    }

    for (const item of plan) {
      if (item.action === "SKIP" || item.action === "REVIEW" || (isScheduledRun && item.action === "ADOPT")) continue;
      if (!item.existingUser) throw new Error("Staff sync plan lost its existing user.");
      const before = item.existingUser;
      const data = { fullName: arborStaffFullName(item.arborStaff), externalId: item.arborStaff.id, dataSource: "ARBOR" };
      const user = await db.user.update({ where: { id: before.id }, data });
      await db.sharedIntegrationSyncChange.create({
        data: {
          syncRunId: run.id,
          tenantId: before.tenantId,
          entityType: "User",
          entityId: user.id,
          changeType: "UPDATE",
          beforeJson: before,
          afterJson: data,
        },
      });
      if (item.action === "ADOPT") linked++;
      else updated++;
    }

    await db.sharedIntegrationSyncRun.update({
      where: { id: run.id },
      data: { status: "SUCCESS", recordsProcessed: linked + updated, recordsUpdated: linked + updated, finishedAt: new Date() },
    });
    await db.sharedIntegration.update({ where: { id: integration.id }, data: { lastSyncedAt: new Date(), lastSyncStatus: "SUCCESS", lastSyncError: null } });
    if (actor) {
      await db.auditLog.create({
        data: { tenantId: PLATFORM_TENANT_ID, actorUserId: actor.id, action: "integration.arbor.staff_synced", targetType: "SharedIntegration", targetId: integration.id, afterJson: { linked, updated } },
      });
    }
    if (isScheduledRun) return NextResponse.json({ linked, updated, skippedUnmatched: plan.filter((item) => item.action === "SKIP").length });
    const url = new URL("/god/integrations/arbor", req.url);
    url.searchParams.set("staffSync", "success");
    url.searchParams.set("linked", String(linked));
    return NextResponse.redirect(url);
  } catch (error) {
    const errorSummary = error instanceof Error ? error.message.slice(0, 500) : "Staff sync failed.";
    if (runId) {
      await db.sharedIntegrationSyncRun.update({
        where: { id: runId },
        data: { status: linked || updated ? "PARTIAL" : "FAILED", recordsProcessed: linked + updated, recordsUpdated: linked + updated, recordsFailed: 1, errorSummary, finishedAt: new Date() },
      });
    }
    await db.sharedIntegration.update({ where: { id: integration.id }, data: { lastSyncStatus: "FAILED", lastSyncError: "Staff sync did not complete. Check the God Mode audit log." } });
    return NextResponse.redirect(new URL("/god/integrations/arbor?staffSync=failed", req.url));
  }
});
