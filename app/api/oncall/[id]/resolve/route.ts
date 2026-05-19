import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { hasOnCallPermission } from "@/lib/rbac";
import { resolveOnCallRequest } from "@/modules/oncall/service";
import { sendOnCallNotification } from "@/modules/oncall/notifications";
import { apiErrorResponse } from "@/lib/apiErrors";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getSessionUserOrThrow();
    await requireFeature(user.tenantId, "ON_CALL");
    if (!hasOnCallPermission(user.role, "oncall:resolve")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const request = await resolveOnCallRequest(params.id, user.tenantId, user.id, body);
    await sendOnCallNotification(user.tenantId, request, "resolved");

    return NextResponse.json(request);
  } catch (err) {
    return apiErrorResponse(err);
  }
}
