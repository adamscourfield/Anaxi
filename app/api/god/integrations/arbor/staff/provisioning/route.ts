import { NextResponse } from "next/server";
import { requireSuperAdminUser } from "@/lib/admin";
import { withApi } from "@/lib/apiRoute";
import { assertCronAuthorized } from "@/lib/cronAuth";
import { assertCsrfFromForm } from "@/lib/csrf";
import { decryptCredentials } from "@/lib/integrationSecrets";
import { ArborClient } from "@/lib/integrations/arbor/client";
import { arborStaffFullName } from "@/lib/integrations/arbor/staffSyncPlan";
import type { ArborCredentials, ArborStaffRecord } from "@/lib/integrations/arbor/types";
import { prisma } from "@/lib/prisma";

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
  const integration = await db.sharedIntegration.findUnique({ where: { provider: "ARBOR" }, include: { schools: { where: { enabled: true }, select: { tenantId: true } } } });
  if (!integration?.credentialsCiphertext || integration.status !== "CONNECTED") return scheduled ? NextResponse.json({ skipped: "not connected" }) : NextResponse.redirect(new URL("/god/integrations/arbor?staffProvisioning=not-connected", req.url));
  try {
    const tenantIds = integration.schools.map((school: { tenantId: string }) => school.tenantId);
    const [staff, users] = await Promise.all([
      new ArborClient(decryptCredentials<ArborCredentials>(integration.credentialsCiphertext)).listAllStaff(),
      db.user.findMany({ where: { tenantId: { in: tenantIds }, externalId: { not: null } }, select: { externalId: true } }),
    ]);
    const linkedIds = new Set(users.map((user: { externalId: string }) => user.externalId));
    const candidates = staff.filter((record) => record.isActiveInSchool && !linkedIds.has(record.id));
    if (candidates.length) await db.staffProvisioningRequest.createMany({
      data: candidates.map((record) => ({ integrationId: integration.id, arborStaffId: record.id, fullName: arborStaffFullName(record), email: staffEmail(record), isTeachingStaff: record.isActiveTeachingInSchool })),
      skipDuplicates: true,
    });
    if (scheduled) return NextResponse.json({ queued: candidates.length });
    const url = new URL("/god/integrations/arbor", req.url);
    url.searchParams.set("staffProvisioning", "success");
    url.searchParams.set("staffProvisioningQueued", String(candidates.length));
    return NextResponse.redirect(url);
  } catch {
    return scheduled ? NextResponse.json({ error: "Staff provisioning discovery failed." }, { status: 500 }) : NextResponse.redirect(new URL("/god/integrations/arbor?staffProvisioning=failed", req.url));
  }
});
