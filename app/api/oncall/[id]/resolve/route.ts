import { after, NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { hasOnCallPermission } from "@/lib/rbac";
import { resolveOnCallRequest } from "@/modules/oncall/service";
import { sendOnCallNotification } from "@/modules/oncall/notifications";
import { apiErrorResponse } from "@/lib/apiErrors";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const user = await getSessionUserOrThrow();
    if (!hasOnCallPermission(user.role, "oncall:resolve")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const request = await resolveOnCallRequest(resolvedParams.id, user.tenantId, user.id, body);
    // Emails go out after the response, so the person acting isn't kept waiting
    // on every recipient (sends are throttled to the email provider's rate limit).
    after(() => sendOnCallNotification(user.tenantId, request, "resolved"));

    return NextResponse.json(request);
  } catch (err) {
    return apiErrorResponse(err);
  }
}
