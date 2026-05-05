import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { hasPermission } from "@/lib/rbac";
import { getMeetingDetail } from "@/modules/meetings/service";
import { MEETING_TYPE_LABELS } from "@/modules/meetings/types";
import { LiveMeetingView } from "@/components/meetings/LiveMeetingView";
import { prisma } from "@/lib/prisma";

export default async function MeetingDetailPage({ params }: { params: { id: string } }) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "MEETINGS");

  let meeting: any;
  try {
    meeting = await getMeetingDetail(user.tenantId, params.id);
  } catch {
    notFound();
  }

  const isAttendee = meeting.attendees.some((a: any) => a.userId === user.id);
  const isCreator = meeting.createdByUserId === user.id;
  const canViewAll = hasPermission(user.role, "meetings:view_all");
  if (!isCreator && !isAttendee && !canViewAll) notFound();

  const canEdit = isCreator || user.role === "ADMIN";
  const canAddActions = hasPermission(user.role, "actions:create") && (isCreator || isAttendee);

  const typeLabel = MEETING_TYPE_LABELS[meeting.type] ?? meeting.type;

  // ── Historical stats for Efficiency Index ────────────────────────────────
  let avgActionsForType = 0;
  try {
    const pastMeetings = await (prisma as any).meeting.findMany({
      where: {
        tenantId: user.tenantId,
        type: meeting.type,
        endedAt: { not: null },
        id: { not: meeting.id },
      },
      select: {
        _count: { select: { actions: true } },
        notes: true,
      },
      orderBy: { startDateTime: "desc" },
      take: 20,
    });
    if (pastMeetings.length > 0) {
      const totalActions = pastMeetings.reduce(
        (sum: number, m: any) => sum + (m._count?.actions ?? 0),
        0,
      );
      avgActionsForType = Math.round(totalActions / pastMeetings.length);
    }
  } catch {
    // Non-critical — fall back to 0
  }

  return (
    <div>
      <div className="mb-4">
        <Link href="/meetings" className="link-accent text-sm">← Meetings</Link>
      </div>

      <LiveMeetingView
        meetingId={meeting.id}
        title={meeting.title}
        type={typeLabel}
        status={meeting.status}
        startDateTime={new Date(meeting.startDateTime).toISOString()}
        startedAt={
          meeting.startedAt ? new Date(meeting.startedAt).toISOString() : null
        }
        endedAt={
          meeting.endedAt ? new Date(meeting.endedAt).toISOString() : null
        }
        attendees={meeting.attendees}
        initialNotes={meeting.notes ?? ""}
        actions={meeting.actions ?? []}
        canEdit={canEdit}
        canStartMeeting={isCreator}
        canAddActions={canAddActions}
        avgActionsForType={avgActionsForType}
      />
    </div>
  );
}
