import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/apiErrors";
import { requireFeature } from "@/lib/guards";
import { fetchLeaveCalendarMonthRequests } from "@/modules/leave/leaveCalendarMonthData";

export async function GET(req: Request) {
  try {
    const user = await getSessionUserOrThrow();
    await requireFeature(user.tenantId, "LEAVE");

    const { searchParams } = new URL(req.url);
    const month = String(searchParams.get("month") || "");

    const requests = await fetchLeaveCalendarMonthRequests({
      tenantId: user.tenantId,
      viewer: user,
      monthKey: month,
    });

    return NextResponse.json({ month, requests });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
