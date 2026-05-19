import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { hasPermission } from "@/lib/rbac";
import { addAttendee, removeAttendee } from "@/modules/meetings/service";
import { apiErrorResponse } from "@/lib/apiErrors";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getSessionUserOrThrow();
    await requireFeature(user.tenantId, "MEETINGS");
    if (!hasPermission(user.role, "meetings:edit")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { userId } = body;
    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

    const attendee = await addAttendee(params.id, userId, user.tenantId);
    return NextResponse.json(attendee, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getSessionUserOrThrow();
    await requireFeature(user.tenantId, "MEETINGS");
    if (!hasPermission(user.role, "meetings:edit")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { userId } = body;
    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

    await removeAttendee(params.id, userId, user.tenantId);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
