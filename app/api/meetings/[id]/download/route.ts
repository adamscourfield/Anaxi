import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { getMeetingDetail } from "@/modules/meetings/service";
import { apiErrorResponse } from "@/lib/apiErrors";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const user = await getSessionUserOrThrow();
    await requireFeature(user.tenantId, "MEETINGS");

    const meeting = await getMeetingDetail(user.tenantId, resolvedParams.id);

    const isAttendee = meeting.attendees.some((a: any) => a.userId === user.id);
    const isCreator = meeting.createdByUserId === user.id;
    if (!isCreator && !isAttendee) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const start = new Date(meeting.startDateTime);
    const dateStr = start.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    const timeStr = start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

    const attendeeNames = meeting.attendees.map((a: any) => a.user.fullName).join(", ");
    const actions = (meeting.actions ?? [])
      .map((a: any) => `  - ${a.description} (Owner: ${a.owner.fullName}, Due: ${a.dueDate ? new Date(a.dueDate).toLocaleDateString("en-GB") : "N/A"}, Status: ${a.status})`)
      .join("\n");

    const durationLine =
      meeting.startedAt && meeting.endedAt
        ? `Session duration: ${Math.round(
            (new Date(meeting.endedAt).getTime() - new Date(meeting.startedAt).getTime()) / 60000,
          )} minutes (started ${new Date(meeting.startedAt).toLocaleString("en-GB")}, ended ${new Date(meeting.endedAt).toLocaleString("en-GB")})`
        : meeting.startedAt
          ? `Live session started: ${new Date(meeting.startedAt).toLocaleString("en-GB")}`
          : null;

    const content = [
      `MEETING MINUTES`,
      `===============`,
      ``,
      `Title: ${meeting.title}`,
      `Date: ${dateStr} at ${timeStr}`,
      `Type: ${meeting.type}`,
      `Status: ${meeting.status}`,
      durationLine,
      meeting.location ? `Location: ${meeting.location}` : null,
      `Attendees: ${attendeeNames}`,
      ``,
      `NOTES`,
      `-----`,
      meeting.notes || "(No notes recorded)",
      ``,
      actions ? `ACTION ITEMS\n------------\n${actions}` : null,
    ]
      .filter((line) => line !== null)
      .join("\n");

    const filename = `${meeting.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_${start.toISOString().slice(0, 10)}.txt`;

    return new NextResponse(content, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
