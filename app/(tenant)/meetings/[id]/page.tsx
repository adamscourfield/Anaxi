import styles from "./page.module.css";
import { notFound } from "next/navigation";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { hasPermission } from "@/lib/rbac";
import { getMeetingDetail } from "@/modules/meetings/service";
import { MEETING_TYPE_LABELS } from "@/modules/meetings/types";
import { LiveMeetingView } from "@/components/meetings/LiveMeetingView";

export default async function MeetingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ from?: string }>;
}) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "MEETINGS");
  const resolvedParams = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  // Only ever go back to the Meetings list on this site ("//evil.example" is an external URL).
  const from = resolvedSearchParams.from ?? "";
  const backHref = /^\/meetings(?:[/?]|$)/.test(from) ? from : "/meetings";

  let meeting: any;
  try {
    meeting = await getMeetingDetail(user.tenantId, resolvedParams.id);
  } catch {
    notFound();
  }

  const isAttendee = meeting.attendees.some((a: any) => a.userId === user.id);
  const isCreator = meeting.createdByUserId === user.id;
  if (!isCreator && !isAttendee && !hasPermission(user.role, "meetings:view_all")) notFound();

  // Same rules as the API, so nobody is offered a button that then fails.
  const canEdit = isCreator || hasPermission(user.role, "meetings:edit");
  const canAddActions =
    hasPermission(user.role, "actions:create") && (isCreator || isAttendee || hasPermission(user.role, "meetings:view_all"));
  const canDelete = isCreator || hasPermission(user.role, "meetings:delete");

  return (
    <div className={styles.page}>
      <LiveMeetingView
        meetingId={meeting.id}
        title={meeting.title}
        type={MEETING_TYPE_LABELS[meeting.type] ?? meeting.type}
        status={meeting.status}
        startDateTime={new Date(meeting.startDateTime).toISOString()}
        endDateTime={new Date(meeting.endDateTime).toISOString()}
        startedAt={meeting.startedAt ? new Date(meeting.startedAt).toISOString() : null}
        endedAt={meeting.endedAt ? new Date(meeting.endedAt).toISOString() : null}
        location={meeting.location ?? null}
        organiser={meeting.createdBy.fullName}
        attendees={meeting.attendees}
        initialNotes={meeting.notes ?? ""}
        actions={meeting.actions ?? []}
        currentUserId={user.id}
        canEdit={canEdit}
        canRun={canEdit}
        canAddActions={canAddActions}
        canCompleteOwnActions={hasPermission(user.role, "actions:manage")}
        canDelete={canDelete}
        backHref={backHref}
      />
    </div>
  );
}
