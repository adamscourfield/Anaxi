import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { hasPermission } from "@/lib/rbac";
import { parseIsoDate } from "@/lib/parseDate";
import { getMeetingDetail, updateMeeting, deleteMeeting } from "@/modules/meetings/service";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getSessionUserOrThrow();
    await requireFeature(user.tenantId, "MEETINGS");
    if (!hasPermission(user.role, "meetings:view_own") && !hasPermission(user.role, "meetings:view_all")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const meeting = await getMeetingDetail(user.tenantId, params.id);

    const isAttendee = meeting.attendees.some((a: any) => a.userId === user.id);
    const isCreator = meeting.createdByUserId === user.id;
    if (!isCreator && !isAttendee && !hasPermission(user.role, "meetings:view_all")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(meeting);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message === "UNAUTHENTICATED") return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    if (message === "FEATURE_DISABLED") return NextResponse.json({ error: "Feature disabled" }, { status: 403 });
    if (message === "meeting not found") return NextResponse.json({ error: message }, { status: 404 });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getSessionUserOrThrow();
    await requireFeature(user.tenantId, "MEETINGS");

    const meetingForAuth = await getMeetingDetail(user.tenantId, params.id);
    const isCreator = meetingForAuth.createdByUserId === user.id;
    const canPatch = hasPermission(user.role, "meetings:edit") || isCreator;
    if (!canPatch) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { title, type, startDateTime, endDateTime, location, notes, status, startedAt, endedAt } = body;

    const input: Record<string, unknown> = {};
    if (title !== undefined) input.title = title;
    if (type !== undefined) input.type = type;
    if (startDateTime !== undefined) {
      const parsed = parseIsoDate(startDateTime);
      if (!parsed) return NextResponse.json({ error: "Invalid startDateTime" }, { status: 400 });
      input.startDateTime = parsed;
    }
    if (endDateTime !== undefined) {
      const parsed = parseIsoDate(endDateTime);
      if (!parsed) return NextResponse.json({ error: "Invalid endDateTime" }, { status: 400 });
      input.endDateTime = parsed;
    }
    if (location !== undefined) input.location = location;
    if (notes !== undefined) input.notes = notes;
    if (status !== undefined) input.status = status;
    if (startedAt !== undefined) {
      if (startedAt === null) {
        return NextResponse.json({ error: "startedAt cannot be cleared" }, { status: 400 });
      }
      input.startedAt = new Date(startedAt);
    }
    if (endedAt !== undefined) {
      if (endedAt === null) {
        return NextResponse.json({ error: "endedAt cannot be cleared" }, { status: 400 });
      }
      input.endedAt = new Date(endedAt);
    }

    const meeting = await updateMeeting(user.tenantId, params.id, { id: user.id, role: user.role }, input as any);
    return NextResponse.json(meeting);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message === "UNAUTHENTICATED") return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    if (message === "FEATURE_DISABLED") return NextResponse.json({ error: "Feature disabled" }, { status: 403 });
    if (message === "meeting not found") return NextResponse.json({ error: message }, { status: 404 });
    if (message === "only creator can update meeting") return NextResponse.json({ error: message }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getSessionUserOrThrow();
    await requireFeature(user.tenantId, "MEETINGS");
    if (!hasPermission(user.role, "meetings:delete")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await deleteMeeting(user.tenantId, params.id, { id: user.id, role: user.role });
    return new NextResponse(null, { status: 204 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message === "UNAUTHENTICATED") return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    if (message === "FEATURE_DISABLED") return NextResponse.json({ error: "Feature disabled" }, { status: 403 });
    if (message === "meeting not found") return NextResponse.json({ error: message }, { status: 404 });
    if (message === "only creator can delete meeting") return NextResponse.json({ error: message }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
