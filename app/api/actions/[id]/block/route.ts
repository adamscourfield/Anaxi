import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { hasPermission } from "@/lib/rbac";
import { blockAction } from "@/modules/actions/service";
import { apiErrorResponse } from "@/lib/apiErrors";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const user = await getSessionUserOrThrow();
    await requireFeature(user.tenantId, "MEETINGS");
    if (!hasPermission(user.role, "actions:manage")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { reason } = body;
    if (!reason) return NextResponse.json({ error: "reason required" }, { status: 400 });

    const action = await blockAction(user.tenantId, resolvedParams.id, user.id, reason);
    return NextResponse.json(action);
  } catch (err) {
    return apiErrorResponse(err);
  }
}
