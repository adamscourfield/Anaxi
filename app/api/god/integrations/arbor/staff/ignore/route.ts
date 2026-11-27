import { NextResponse } from "next/server";
import { requireSuperAdminUser } from "@/lib/admin";
import { withApi } from "@/lib/apiRoute";
import { assertCsrfFromForm } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";

export const POST = withApi(async function POST(req: Request) {
  const actor = await requireSuperAdminUser();
  const form = await req.formData();
  try {
    await assertCsrfFromForm(form);
  } catch {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }
  const requestId = String(form.get("requestId") ?? "");
  const db = prisma as any;
  const request = await db.staffProvisioningRequest.findUnique({ where: { id: requestId } });
  if (!request) return NextResponse.json({ error: "Staff review record not found" }, { status: 404 });
  await db.$transaction(async (tx: any) => {
    const ignored = await tx.staffProvisioningRequest.updateMany({
      where: { id: requestId, status: "PENDING" },
      data: { status: "DISMISSED", dismissedAt: new Date() },
    });
    if (ignored.count) await tx.auditLog.create({ data: {
      tenantId: actor.tenantId, actorUserId: actor.id,
      action: "integration.arbor.staff_ignored", targetType: "StaffProvisioningRequest", targetId: requestId,
      afterJson: { status: "DISMISSED", integrationId: request.integrationId },
    } });
  });
  const url = new URL("/god/integrations/arbor", req.url);
  url.searchParams.set("connectionId", request.integrationId);
  url.searchParams.set("staffProvisioning", "ignored");
  url.hash = "staff-review";
  return NextResponse.redirect(url, 303);
});
