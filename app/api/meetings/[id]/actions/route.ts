import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { hasPermission } from "@/lib/rbac";
import { createAction } from "@/modules/actions/service";
import { getMeetingDetail } from "@/modules/meetings/service";
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

    // Only people in the meeting (or staff who can see every meeting) add its actions,
    // and actions go to someone who was in it.
    const meeting = await getMeetingDetail(user.tenantId, resolvedParams.id);
    const attendeeIds = new Set<string>(meeting.attendees.map((a: { userId: string }) => a.userId));
    const isCreator = meeting.createdByUserId === user.id;
    if (!isCreator && !attendeeIds.has(user.id) && !hasPermission(user.role, "meetings:view_all")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!attendeeIds.has(ownerUserId) && ownerUserId !== meeting.createdByUserId) {
      return NextResponse.json({ error: "Actions can only be given to someone in the meeting." }, { status: 400 });
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
