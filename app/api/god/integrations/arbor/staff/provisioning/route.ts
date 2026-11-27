import { NextResponse } from "next/server";
import { arborConnectionWhere } from "@/lib/integrations/arbor/connectionScope";
import { requireSuperAdminUser } from "@/lib/admin";
import { withApi } from "@/lib/apiRoute";
import { assertCronAuthorized } from "@/lib/cronAuth";
import { assertCsrfFromForm } from "@/lib/csrf";
import { decryptCredentials } from "@/lib/integrationSecrets";
import { ArborClient } from "@/lib/integrations/arbor/client";
import { arborStaffFullName } from "@/lib/integrations/arbor/staffSyncPlan";
import type { ArborCredentials, ArborStaffRecord } from "@/lib/integrations/arbor/types";
import { prisma } from "@/lib/prisma";

export const maxDuration = 300;

function staffEmail(staff: ArborStaffRecord): string | null {
  const value = staff.emailAddresses.map((address) => address.displayName.trim()).find((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
  return value?.toLowerCase() ?? null;
}

/** Finds new Arbor staff but deliberately grants no Anaxi access without approval. */
export const POST = withApi(async function POST(req: Request) {
  const denied = assertCronAuthorized(req);
  const scheduled = !denied && req.headers.get("x-arbor-scheduled-sync") === "1";
  if (!scheduled) {
    await requireSuperAdminUser();
    const form = await req.formData();
    try { await assertCsrfFromForm(form); } catch { return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }); }
  }
  const db = prisma as any;
  const integration = await db.sharedIntegration.findFirst({ where: arborConnectionWhere(req), include: { schools: { where: { enabled: true }, select: { tenantId: true } } } });
  if (!integration?.credentialsCiphertext || integration.status !== "CONNECTED") return scheduled ? NextResponse.json({ skipped: "not connected" }) : NextResponse.redirect(new URL("/god/integrations/arbor?staffProvisioning=not-connected", req.url));
  try {
    const tenantIds = integration.schools.map((school: { tenantId: string }) => school.tenantId);
    const [staff, users] = await Promise.all([
      new ArborClient(decryptCredentials<ArborCredentials>(integration.credentialsCiphertext)).listAllStaff(),
      db.user.findMany({ where: { tenantId: { in: tenantIds } }, select: { id: true, externalId: true, email: true, dataSource: true } }),
    ]);
    await db.staffProvisioningRequest.updateMany({
      where: { integrationId: integration.id, status: "PENDING", arborStaffId: { in: staff.filter((record) => !record.isActiveInSchool).map((record) => record.id) } },
      data: { status: "DISMISSED", dismissedAt: new Date() },
    });
    const linkedIds = new Set(users.filter((user: { dataSource: string }) => user.dataSource === "ARBOR").map((user: { externalId: string }) => user.externalId));
    const ignored = await db.staffProvisioningRequest.findMany({
      where: { integrationId: integration.id, status: "DISMISSED" }, select: { arborStaffId: true },
    });
    const ignoredIds = new Set(ignored.map((request: { arborStaffId: string }) => request.arborStaffId));
    const activeStaff = staff.filter((record) => record.isActiveInSchool);
    let linkedExisting = 0;
    for (const record of activeStaff) {
      if (ignoredIds.has(record.id)) continue;
      const email = staffEmail(record);
      if (!email || activeStaff.filter((other) => staffEmail(other) === email).length !== 1) continue;
      const matches = users.filter((user: { email: string; externalId: string | null }) => user.email.trim().toLowerCase() === email && !user.externalId);
      for (const user of matches) {
        const linked = await db.user.updateMany({
          where: { id: user.id, externalId: null },
          data: { externalId: record.id, dataSource: "ARBOR" },
        });
        if (linked.count) { linkedExisting++; linkedIds.add(record.id); }
      }
    }
    // Retain resolved rows so discovery is idempotent and ignored records stay ignored.
    await db.staffProvisioningRequest.updateMany({
      where: { integrationId: integration.id, status: "PENDING", arborStaffId: { in: [...linkedIds].filter(Boolean) } },
      data: { status: "PROVISIONED", provisionedAt: new Date() },
    });
    const candidates = staff.filter((record) => record.isActiveInSchool && !linkedIds.has(record.id));
    const queued = candidates.length ? await db.staffProvisioningRequest.createMany({
      data: candidates.map((record) => ({ integrationId: integration.id, arborStaffId: record.id, fullName: arborStaffFullName(record), email: staffEmail(record), isTeachingStaff: record.isActiveTeachingInSchool })),
      skipDuplicates: true,
    }) : { count: 0 };
    if (scheduled) return NextResponse.json({ queued: queued.count, linkedExisting });
    const url = new URL("/god/integrations/arbor", req.url);
    url.searchParams.set("staffProvisioning", "success");
    url.searchParams.set("staffProvisioningQueued", String(queued.count));
    return NextResponse.redirect(url);
  } catch {
    return scheduled ? NextResponse.json({ error: "Staff provisioning discovery failed." }, { status: 500 }) : NextResponse.redirect(new URL("/god/integrations/arbor?staffProvisioning=failed", req.url));
  }
});
