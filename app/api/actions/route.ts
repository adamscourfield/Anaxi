import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { hasPermission } from "@/lib/rbac";
import { getMyActions } from "@/modules/actions/service";
import { apiErrorResponse } from "@/lib/apiErrors";

export async function GET(req: Request) {
  try {
    const user = await getSessionUserOrThrow();
    await requireFeature(user.tenantId, "MEETINGS");
    if (!hasPermission(user.role, "actions:view_own")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const grouped = await getMyActions(user.tenantId, user.id);
    return NextResponse.json(grouped);
  } catch (err) {
    return apiErrorResponse(err);
  }
}
