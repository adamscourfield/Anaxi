import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { hasPermission } from "@/lib/rbac";
import { getActionDetail, updateActionStatus } from "@/modules/actions/service";
import { apiErrorResponse } from "@/lib/apiErrors";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const user = await getSessionUserOrThrow();
    await requireFeature(user.tenantId, "MEETINGS");
    if (!hasPermission(user.role, "actions:view_own")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const action = await getActionDetail(user.tenantId, resolvedParams.id);
    if (action.ownerUserId !== user.id && !hasPermission(user.role, "meetings:view_all")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(action);
  } catch (err) {
    return apiErrorResponse(err);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const user = await getSessionUserOrThrow();
    await requireFeature(user.tenantId, "MEETINGS");
    if (!hasPermission(user.role, "actions:manage")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { status } = body;
    if (!status) return NextResponse.json({ error: "status required" }, { status: 400 });

    const action = await updateActionStatus(user.tenantId, resolvedParams.id, user.id, { status });
    return NextResponse.json(action);
  } catch (err) {
    return apiErrorResponse(err);
  }
}
