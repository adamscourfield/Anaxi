import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/apiErrors";
import { sendMeetingCancelledEmail, sendMeetingUpdatedEmail } from "@/lib/email";
import { requireFeature } from "@/lib/guards";
import { hasPermission } from "@/lib/rbac";
import { parseIsoDate } from "@/lib/parseDate";
import { getMeetingDetail, updateMeeting, deleteMeeting } from "@/modules/meetings/service";

function scheduleChanged(
  existing: { startDateTime: Date; endDateTime: Date; location?: string | null; title: string },
  input: Record<string, unknown>,
): boolean {
  if (input.title !== undefined && input.title !== existing.title) return true;
  if (input.location !== undefined && input.location !== existing.location) return true;
  if (input.startDateTime !== undefined) {
    if (new Date(input.startDateTime as Date).getTime() !== new Date(existing.startDateTime).getTime()) {
      return true;
    }
  }
  if (input.endDateTime !== undefined) {
    if (new Date(input.endDateTime as Date).getTime() !== new Date(existing.endDateTime).getTime()) {
      return true;
    }
  }
  return false;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const user = await getSessionUserOrThrow();
    await requireFeature(user.tenantId, "MEETINGS");
    if (!hasPermission(user.role, "meetings:view_own") && !hasPermission(user.role, "meetings:view_all")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const meeting = await getMeetingDetail(user.tenantId, resolvedParams.id);

    const isAttendee = meeting.attendees.some((a: { userId: string }) => a.userId === user.id);
    const isCreator = meeting.createdByUserId === user.id;
    if (!isCreator && !isAttendee && !hasPermission(user.role, "meetings:view_all")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(meeting);
  } catch (err) {
    return apiErrorResponse(err);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const user = await getSessionUserOrThrow();
    await requireFeature(user.tenantId, "MEETINGS");

    const meetingForAuth = await getMeetingDetail(user.tenantId, resolvedParams.id);
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

    const notifyUpdate = scheduleChanged(meetingForAuth, input);
    const meeting = await updateMeeting(user.tenantId, resolvedParams.id, { id: user.id, role: user.role }, input as any);

    if (notifyUpdate) {
      void Promise.allSettled(
        meeting.attendees.map(
          (attendee: { userId: string; user: { email: string; fullName: string } }) => {
            if (attendee.userId === user.id) return Promise.resolve();
            return sendMeetingUpdatedEmail({
              to: attendee.user.email,
              attendeeName: attendee.user.fullName,
              title: meeting.title,
              startDateTime: new Date(meeting.startDateTime),
              endDateTime: new Date(meeting.endDateTime),
              meetingId: meeting.id,
              tenantId: user.tenantId,
              attendeeUserId: attendee.userId,
              location: meeting.location,
            });
          },
        ),
      );
    }

    return NextResponse.json(meeting);
  } catch (err) {
    return apiErrorResponse(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const user = await getSessionUserOrThrow();
    await requireFeature(user.tenantId, "MEETINGS");
    if (!hasPermission(user.role, "meetings:delete")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const meeting = await getMeetingDetail(user.tenantId, resolvedParams.id);

    void Promise.allSettled(
      meeting.attendees.map(
        (attendee: { userId: string; user: { email: string; fullName: string } }) => {
          if (attendee.userId === user.id) return Promise.resolve();
          return sendMeetingCancelledEmail({
            to: attendee.user.email,
            attendeeName: attendee.user.fullName,
            title: meeting.title,
            startDateTime: new Date(meeting.startDateTime),
            meetingId: meeting.id,
            tenantId: user.tenantId,
            attendeeUserId: attendee.userId,
          });
        },
      ),
    );

    await deleteMeeting(user.tenantId, resolvedParams.id, { id: user.id, role: user.role });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
