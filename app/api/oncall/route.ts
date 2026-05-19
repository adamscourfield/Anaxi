import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { hasOnCallPermission } from "@/lib/rbac";
import { createOnCallRequest, getRequestsByStatus } from "@/modules/oncall/service";
import { sendOnCallNotification } from "@/modules/oncall/notifications";
import { apiErrorResponse } from "@/lib/apiErrors";
import { onCallCreateBodySchema, parseBody } from "@/lib/validation/schemas";

export async function POST(req: Request) {
  try {
    const user = await getSessionUserOrThrow();
    await requireFeature(user.tenantId, "ON_CALL");
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

    await sendOnCallNotification(user.tenantId, request, "created");

    return NextResponse.json(request, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

export async function GET(req: Request) {
  try {
    const user = await getSessionUserOrThrow();
    await requireFeature(user.tenantId, "ON_CALL");

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") ?? undefined;
    const take = Math.min(Number(searchParams.get("take") ?? "20"), 100);
    const skip = Number(searchParams.get("skip") ?? "0");

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
