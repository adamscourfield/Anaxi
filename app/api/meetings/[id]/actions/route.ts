import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { hasPermission } from "@/lib/rbac";
import { createAction } from "@/modules/actions/service";
import { apiErrorResponse } from "@/lib/apiErrors";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const user = await getSessionUserOrThrow();
    await requireFeature(user.tenantId, "MEETINGS");
    if (!hasPermission(user.role, "actions:create")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { description, ownerUserId, dueDate } = body;

    if (!description || !ownerUserId) {
      return NextResponse.json({ error: "description and ownerUserId are required" }, { status: 400 });
    }

    const action = await createAction(user.tenantId, resolvedParams.id, user.id, {
      description,
      ownerUserId,
      dueDate: dueDate ? new Date(dueDate) : undefined,
    });

    return NextResponse.json(action, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
