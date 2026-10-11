import styles from "./page.module.css";
import { notFound } from "next/navigation";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { hasPermission } from "@/lib/rbac";
import { getMeetingDetail } from "@/modules/meetings/service";
import { MEETING_TYPE_LABELS } from "@/modules/meetings/types";
import { LiveMeetingView } from "@/components/meetings/LiveMeetingView";
import { PageHeader } from "@/components/ui/page-header";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { prisma } from "@/lib/prisma";

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
  const backHref =
    resolvedSearchParams.from && resolvedSearchParams.from.startsWith("/")
      ? resolvedSearchParams.from
      : "/meetings";

  if (process.env.NODE_ENV === "development" && resolvedParams.id === "design-preview") {
    return <div className={`${styles.page} space-y-6`}>
      <PageHeader variant="ledger" title="Year team review" subtitle="Staff meeting · 11 Oct 2026, 09:00" eyebrow={<Breadcrumb items={[{ label: "Meetings", href: backHref }, { label: "Year team review" }]} />} />
      <LiveMeetingView meetingId="design-preview" title="Year team review" type="Staff meeting" status="CONFIRMED" startDateTime="2026-10-11T09:00:00Z" startedAt={null} endedAt={null}
        attendees={[{ id:"preview", userId:user.id, user:{id:user.id,fullName:"Example teacher",email:"preview@example.invalid"} }]}
        initialNotes="Agenda

Review attendance and pupil support.
Agree priorities for the coming week."
        actions={[{ id:"preview-action",description:"Review support plans before the next meeting",ownerUserId:user.id,owner:{id:user.id,fullName:"Example teacher"},status:"OPEN" }]}
        canEdit={false} canStartMeeting={false} canAddActions={false} canDelete={false} previewMode />
    </div>;
  }

  let meeting: any;
  try {
    meeting = await getMeetingDetail(user.tenantId, resolvedParams.id);
  } catch {
    notFound();
  }

  const isAttendee = meeting.attendees.some((a: any) => a.userId === user.id);
  const isCreator = meeting.createdByUserId === user.id;
  const canViewAll = hasPermission(user.role, "meetings:view_all");
  if (!isCreator && !isAttendee && !canViewAll) notFound();

  const canEdit = isCreator || user.role === "ADMIN";
  const canAddActions = hasPermission(user.role, "actions:create") && (isCreator || isAttendee);
  const canDelete = isCreator || hasPermission(user.role, "meetings:delete");

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
    <div className={`${styles.page} space-y-6`}>
      <PageHeader
        variant="ledger"
        title={meeting.title}
        subtitle={`${typeLabel} · ${new Date(meeting.startDateTime).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}`}
        eyebrow={
          <Breadcrumb
            items={[
              { label: "Meetings", href: backHref },
              { label: meeting.title },
            ]}
          />
        }
      />

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
        canDelete={canDelete}
        avgActionsForType={avgActionsForType}
      />
    </div>
  );
}
