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

const BATCH_SIZE = 25;

export const POST = withApi(async function POST(req: Request) {
  const denied = assertCronAuthorized(req);
  const scheduled = !denied && req.headers.get("x-arbor-scheduled-sync") === "1";
  const actor = scheduled ? null : await requireSuperAdminUser();
  if (!scheduled) {
    const form = await req.formData();
    try { await assertCsrfFromForm(form); } catch { return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }); }
    if (form.get("confirm") !== "SYNC_PHOTOS") return NextResponse.redirect(new URL("/god/integrations/arbor?photoSync=confirmation-required", req.url));
  }
  const db = prisma as any;
  const integration = await db.sharedIntegration.findUnique({ where: { provider: "ARBOR" }, include: { schools: { where: { enabled: true }, select: { tenantId: true } } } });
  if (!integration?.credentialsCiphertext || integration.status !== "CONNECTED") return NextResponse.redirect(new URL("/god/integrations/arbor?photoSync=not-connected", req.url));
  const tenantIds = integration.schools.map((school: { tenantId: string }) => school.tenantId);
  const [students, staff] = await Promise.all([
    db.student.findMany({ where: { tenantId: { in: tenantIds }, status: "ACTIVE", dataSource: "ARBOR", externalId: { not: null }, OR: [{ avatarDataSource: null, avatarUpdatedAt: null }, { avatarDataSource: "ARBOR" }] }, select: { id: true, externalId: true }, orderBy: { avatarUpdatedAt: "asc" }, take: BATCH_SIZE }),
    db.user.findMany({ where: { tenantId: { in: tenantIds }, isActive: true, dataSource: "ARBOR", externalId: { not: null }, OR: [{ avatarDataSource: null, avatarUpdatedAt: null }, { avatarDataSource: "ARBOR" }] }, select: { id: true, externalId: true }, orderBy: { avatarUpdatedAt: "asc" }, take: BATCH_SIZE }),
  ]);
  const client = new ArborClient(decryptCredentials<ArborCredentials>(integration.credentialsCiphertext));
  let studentPhotos = 0, staffPhotos = 0, failed = 0;
  for (const student of students) {
    try { const photo = await client.getStudentPhoto(student.externalId); if (photo) { await db.student.update({ where: { id: student.id }, data: { avatarImage: photo.bytes, avatarMimeType: photo.mimeType, avatarUpdatedAt: new Date(), avatarDataSource: "ARBOR" } }); studentPhotos++; } } catch { failed++; }
  }
  for (const user of staff) {
    try { const photo = await client.getStaffPhoto(user.externalId); if (photo) { await db.user.update({ where: { id: user.id }, data: { avatarImage: photo.bytes, avatarMimeType: photo.mimeType, avatarUpdatedAt: new Date(), avatarDataSource: "ARBOR" } }); staffPhotos++; } } catch { failed++; }
  }
  if (actor) await db.auditLog.create({ data: { tenantId: PLATFORM_TENANT_ID, actorUserId: actor.id, action: "integration.arbor.photos_synced", targetType: "SharedIntegration", targetId: integration.id, afterJson: { studentPhotos, staffPhotos, failed } } });
  if (scheduled) return NextResponse.json({ studentPhotos, staffPhotos, failed, batchesRemaining: students.length === BATCH_SIZE || staff.length === BATCH_SIZE });
  const url = new URL("/god/integrations/arbor", req.url); url.searchParams.set("photoSync", "success"); url.searchParams.set("studentPhotos", String(studentPhotos)); url.searchParams.set("staffPhotos", String(staffPhotos)); return NextResponse.redirect(url);
});
