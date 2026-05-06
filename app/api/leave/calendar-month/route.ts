import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { canManageLoa } from "@/lib/loa";
import { fetchLeaveCalendarMonthRequests } from "@/modules/leave/leaveCalendarMonthData";

export async function GET(req: Request) {
  try {
    const user = await getSessionUserOrThrow();
    await requireFeature(user.tenantId, "LEAVE");
    const manager = await canManageLoa(user);

    const { searchParams } = new URL(req.url);
    const month = String(searchParams.get("month") || "");

    const requests = await fetchLeaveCalendarMonthRequests({
      tenantId: user.tenantId,
      viewerUserId: user.id,
      manager,
      monthKey: month,
    });

    return NextResponse.json({ month, requests });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
