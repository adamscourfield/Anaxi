import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { sendMeetingInviteEmail } from "@/lib/email";
import { requireFeature } from "@/lib/guards";
import { hasPermission } from "@/lib/rbac";
import { createMeeting, listMeetings } from "@/modules/meetings/service";

export async function POST(req: Request) {
  try {
    const user = await getSessionUserOrThrow();
    await requireFeature(user.tenantId, "MEETINGS");
    if (!hasPermission(user.role, "meetings:create")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { title, type, startDateTime, endDateTime, location, notes, attendeeIds = [] } = body;

    if (!title || !type || !startDateTime || !endDateTime) {
      return NextResponse.json({ error: "title, type, startDateTime and endDateTime are required" }, { status: 400 });
    }

    const start = new Date(startDateTime);
    const end = new Date(endDateTime);
    if (end <= start) {
      return NextResponse.json({ error: "endDateTime must be after startDateTime" }, { status: 400 });
    }

    const meeting = await createMeeting(user.tenantId, user.id, {
      title,
      type,
      startDateTime: start,
      endDateTime: end,
      location,
      notes,
      attendeeIds,
    });

    void Promise.allSettled(
      meeting.attendees.map((attendee: { user: { email: string; fullName: string } }) =>
        sendMeetingInviteEmail({
          to: attendee.user.email,
          attendeeName: attendee.user.fullName,
          title: meeting.title,
          startDateTime: new Date(meeting.startDateTime),
          meetingId: meeting.id,
        })
      )
    );

    return NextResponse.json(meeting, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message === "UNAUTHENTICATED") return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    if (message === "FEATURE_DISABLED") return NextResponse.json({ error: "Feature disabled" }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET(req: Request) {
  try {
    const user = await getSessionUserOrThrow();
    await requireFeature(user.tenantId, "MEETINGS");
    const canViewAll = hasPermission(user.role, "meetings:view_all");
    const canViewOwn = hasPermission(user.role, "meetings:view_own");
    if (!canViewAll && !canViewOwn) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") ?? undefined;
    const from = searchParams.get("from") ? new Date(searchParams.get("from")!) : undefined;
    const to = searchParams.get("to") ? new Date(searchParams.get("to")!) : undefined;
    const isAttendee = !canViewAll || searchParams.get("isAttendee") === "true";

    const meetings = await listMeetings(user.tenantId, {
      type,
      dateRange: from || to ? { from, to } : undefined,
      isAttendee: isAttendee && !canViewAll,
      userId: user.id,
    });

    return NextResponse.json(meetings);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message === "UNAUTHENTICATED") return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    if (message === "FEATURE_DISABLED") return NextResponse.json({ error: "Feature disabled" }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
