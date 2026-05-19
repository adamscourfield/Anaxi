import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { hasOnCallPermission } from "@/lib/rbac";
import { createOnCallRequest, getRequestsByStatus } from "@/modules/oncall/service";
import { sendOnCallNotification } from "@/modules/oncall/notifications";

export async function POST(req: Request) {
  try {
    const user = await getSessionUserOrThrow();
    await requireFeature(user.tenantId, "ON_CALL");
    if (!hasOnCallPermission(user.role, "oncall:create")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { studentId, requestType, location, behaviourReasonCategory, notes, isEmergency } = body;

    if (!studentId || !requestType || !location) {
      return NextResponse.json({ error: "studentId, requestType and location are required" }, { status: 400 });
    }
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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message === "UNAUTHENTICATED") return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    if (message === "FEATURE_DISABLED") return NextResponse.json({ error: "Feature disabled" }, { status: 403 });
    if (message === "student not found") return NextResponse.json({ error: message }, { status: 404 });
    return NextResponse.json({ error: message }, { status: 400 });
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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message === "UNAUTHENTICATED") return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    if (message === "FEATURE_DISABLED") return NextResponse.json({ error: "Feature disabled" }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
