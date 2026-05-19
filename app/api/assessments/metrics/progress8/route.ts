import { type NextRequest, NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { getProgress8ForPoint } from "@/modules/assessments/progress8";
import { apiErrorResponse } from "@/lib/apiErrors";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUserOrThrow();
    const pointId = req.nextUrl.searchParams.get("pointId");
    if (!pointId) {
      return NextResponse.json({ error: "pointId is required" }, { status: 400 });
    }
    const data = await getProgress8ForPoint(pointId, user.tenantId);
    return NextResponse.json(data);
  } catch (err) {
    return apiErrorResponse(err);
  }
}
