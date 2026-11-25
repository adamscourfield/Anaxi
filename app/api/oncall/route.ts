import { after, NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { hasOnCallPermission } from "@/lib/rbac";
import { createOnCallRequest, getRequestsByStatus } from "@/modules/oncall/service";
import { sendOnCallNotification } from "@/modules/oncall/notifications";
import { apiErrorResponse } from "@/lib/apiErrors";
import { onCallCreateBodySchema, parseBody } from "@/lib/validation/schemas";

export async function POST(req: Request) {
  try {
    const user = await getSessionUserOrThrow();
    if (!hasOnCallPermission(user.role, "oncall:create")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { studentId, requestType, location, behaviourReasonCategory, notes, isEmergency } =
      parseBody(onCallCreateBodySchema, await req.json());

    if (requestType === "BEHAVIOUR" && !behaviourReasonCategory) {
      return NextResponse.json({ error: "behaviourReasonCategory required for BEHAVIOUR type" }, { status: 400 });
    }

    const request = await createOnCallRequest(user.tenantId, user.id, {
      studentId,
      requestType,
      location,
      behaviourReasonCategory,
      notes,
      isEmergency: Boolean(isEmergency),
    });

    // Emails go out after the response, so the person acting isn't kept waiting
    // on every recipient (sends are throttled to the email provider's rate limit).
    after(() => sendOnCallNotification(user.tenantId, request, "created"));

    return NextResponse.json(request, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

export async function GET(req: Request) {
  try {
    const user = await getSessionUserOrThrow();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") ?? undefined;
    const takeParam = Number(searchParams.get("take") ?? "20");
    const skipParam = Number(searchParams.get("skip") ?? "0");
    const take = Number.isFinite(takeParam) ? Math.min(Math.max(Math.trunc(takeParam), 1), 100) : 20;
    const skip = Number.isFinite(skipParam) ? Math.max(Math.trunc(skipParam), 0) : 0;

    const canViewAll = hasOnCallPermission(user.role, "oncall:view_all");

    if (!canViewAll) {
      const { data, total } = await getRequestsByStatus(
        user.tenantId,
        status,
        take,
        skip,
        user.id
      );
      return NextResponse.json({ data, total, skip, take });
    }

    const { data, total } = await getRequestsByStatus(user.tenantId, status, take, skip);
    return NextResponse.json({ data, total, skip, take });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
