import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { cancelOnCallRequest } from "@/modules/oncall/service";
import { apiErrorResponse } from "@/lib/apiErrors";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const user = await getSessionUserOrThrow();
    await requireFeature(user.tenantId, "ON_CALL");

    const request = await cancelOnCallRequest(resolvedParams.id, user.tenantId, user.id);
    return NextResponse.json(request);
  } catch (err) {
    return apiErrorResponse(err);
  }
}
