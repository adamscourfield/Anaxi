import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import type { UserRole } from "@/lib/types";
import { CreateMeetingInput, UpdateMeetingInput } from "./types";

export type MeetingActor = { id: string; role: UserRole };

function canMutateMeeting(
  createdByUserId: string,
  actor: MeetingActor,
  permission: "meetings:edit" | "meetings:delete"
) {
  if (createdByUserId === actor.id) return true;
  return hasPermission(actor.role, permission);
}

const MEETING_INCLUDE = {
  createdBy: { select: { id: true, fullName: true, email: true } },
  attendees: { include: { user: { select: { id: true, fullName: true, email: true } } } },
  actions: {
    include: {
      owner: { select: { id: true, fullName: true, email: true } },
      createdBy: { select: { id: true, fullName: true, email: true } },
      completedBy: { select: { id: true, fullName: true } },
    },
    orderBy: { dueDate: "asc" as const },
  },
};

export async function createMeeting(
  tenantId: string,
  createdByUserId: string,
  input: CreateMeetingInput
) {
  if (!input.title) throw new Error("title required");
  if (!input.startDateTime || !input.endDateTime) throw new Error("startDateTime and endDateTime required");
  if (input.endDateTime <= input.startDateTime) throw new Error("endDateTime must be after startDateTime");

  const allAttendeeIds = [...new Set([...input.attendeeIds, createdByUserId])];
  const validAttendees = await (prisma as any).user.findMany({
    where: { tenantId, id: { in: allAttendeeIds }, isActive: true },
    select: { id: true },
  });

  return (prisma as any).meeting.create({
    data: {
      tenantId,
      title: input.title,
      type: input.type,
      status: input.status ?? "PENDING",
      startDateTime: input.startDateTime,
      endDateTime: input.endDateTime,
      startedAt: input.startedAt ?? null,
      location: input.location ?? null,
      notes: input.notes ?? null,
      createdByUserId,
      attendees: {
        createMany: {
          data: validAttendees.map((u: { id: string }) => ({ userId: u.id })),
        },
      },
    },
    include: MEETING_INCLUDE,
  });
}

export async function getMeetingDetail(tenantId: string, meetingId: string) {
  const meeting = await (prisma as any).meeting.findFirst({
    where: { id: meetingId, tenantId },
    include: MEETING_INCLUDE,
  });
  if (!meeting) throw new Error("meeting not found");
  return meeting;
}

export async function updateMeeting(
  tenantId: string,
  meetingId: string,
  actor: MeetingActor,
  input: UpdateMeetingInput
) {
  const existing = await (prisma as any).meeting.findFirst({ where: { id: meetingId, tenantId } });
  if (!existing) throw new Error("meeting not found");
  if (!canMutateMeeting(existing.createdByUserId, actor, "meetings:edit")) {
    throw new Error("only creator can update meeting");
  }

  const nextStart = input.startDateTime ?? existing.startDateTime;
  const nextEnd = input.endDateTime ?? existing.endDateTime;
  if (new Date(nextEnd) <= new Date(nextStart)) {
    throw new Error("endDateTime must be after startDateTime");
  }

  const data: Record<string, unknown> = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.type !== undefined) data.type = input.type;
  if (input.startDateTime !== undefined) data.startDateTime = input.startDateTime;
  if (input.endDateTime !== undefined) data.endDateTime = input.endDateTime;
  if (input.location !== undefined) data.location = input.location;
  if (input.notes !== undefined) data.notes = input.notes;
  if (input.status !== undefined) data.status = input.status;
  if (input.startedAt !== undefined) {
    if (existing.status === "CANCELLED") {
      throw new Error("cannot start a cancelled meeting");
    }
    if (existing.endedAt != null) {
      throw new Error("cannot start a meeting that has already ended");
    }
    if (existing.startedAt != null && input.startedAt != null) {
      throw new Error("meeting already started");
    }
    data.startedAt = input.startedAt;
  }

  if (input.endedAt !== undefined) {
    if (input.endedAt === null) {
      throw new Error("endedAt cannot be cleared");
    }
    if (existing.status === "CANCELLED") {
      throw new Error("cannot end a cancelled meeting");
    }
    if (existing.startedAt == null) {
      throw new Error("cannot end meeting before it has been started");
    }
    if (existing.endedAt != null) {
      throw new Error("meeting already ended");
    }
    const endMs = input.endedAt.getTime();
    const startMs = new Date(existing.startedAt).getTime();
    if (endMs < startMs) {
      throw new Error("endedAt must be after startedAt");
    }
    data.endedAt = input.endedAt;
    data.endDateTime = input.endedAt;
    if (existing.status === "PENDING") {
      data.status = "CONFIRMED";
    }
  }

  return (prisma as any).meeting.update({
    where: { id: meetingId },
    data,
    include: MEETING_INCLUDE,
  });
}

export async function deleteMeeting(tenantId: string, meetingId: string, actor: MeetingActor) {
  const existing = await (prisma as any).meeting.findFirst({ where: { id: meetingId, tenantId } });
  if (!existing) throw new Error("meeting not found");
  if (!canMutateMeeting(existing.createdByUserId, actor, "meetings:delete")) {
    throw new Error("only creator can delete meeting");
  }

  await (prisma as any).meeting.delete({ where: { id: meetingId } });
}

export async function addAttendee(meetingId: string, userId: string, tenantId: string) {
  const meeting = await (prisma as any).meeting.findFirst({ where: { id: meetingId, tenantId } });
  if (!meeting) throw new Error("meeting not found");

  const attendeeUser = await (prisma as any).user.findFirst({
    where: { id: userId, tenantId, isActive: true },
    select: { id: true },
  });
  if (!attendeeUser) throw new Error("attendee user not found in tenant");

  return (prisma as any).meetingAttendee.upsert({
    where: { meetingId_userId: { meetingId, userId } },
    create: { meetingId, userId, tenantId },
    update: {},
  });
}

export async function removeAttendee(meetingId: string, userId: string, tenantId: string) {
  const meeting = await (prisma as any).meeting.findFirst({ where: { id: meetingId, tenantId } });
  if (!meeting) throw new Error("meeting not found");

  await (prisma as any).meetingAttendee.delete({
    where: { meetingId_userId: { meetingId, userId } },
  });
}

export async function listMeetings(
  tenantId: string,
  filters: { type?: string; dateRange?: { from?: Date; to?: Date }; isAttendee?: boolean; userId?: string } = {}
) {
  const where: Record<string, unknown> = { tenantId };

  if (filters.type) where.type = filters.type;
  if (filters.dateRange?.from || filters.dateRange?.to) {
    where.startDateTime = {};
    if (filters.dateRange.from) (where.startDateTime as any).gte = filters.dateRange.from;
    if (filters.dateRange.to) (where.startDateTime as any).lte = filters.dateRange.to;
  }
  if (filters.isAttendee && filters.userId) {
    where.attendees = { some: { userId: filters.userId } };
  }

  return (prisma as any).meeting.findMany({
    where,
    include: {
      ...MEETING_INCLUDE,
      _count: { select: { actions: true } },
    },
    orderBy: { startDateTime: "desc" },
  });
}

export async function getMeetingStats(tenantId: string, userId?: string) {
  const actionWhere: Record<string, unknown> = { tenantId };
  if (userId) actionWhere.ownerUserId = userId;

  const meetingWhere: Record<string, unknown> = { tenantId, startDateTime: { gte: new Date() } };
  if (userId) meetingWhere.attendees = { some: { userId } };

  const [openActions, totalActions, doneActions, nextMeeting] = await Promise.all([
    (prisma as any).meetingAction.count({
      where: { ...actionWhere, status: "OPEN" },
    }),
    (prisma as any).meetingAction.count({
      where: actionWhere,
    }),
    (prisma as any).meetingAction.count({
      where: { ...actionWhere, status: "DONE" },
    }),
    (prisma as any).meeting.findFirst({
      where: meetingWhere,
      orderBy: { startDateTime: "asc" },
      select: { id: true, title: true, startDateTime: true, location: true },
    }),
  ]);

  const completionRate = totalActions > 0 ? Math.round((doneActions / totalActions) * 100) : 0;

  // Count actions created since last Monday for the trend
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const lastMonday = new Date(now);
  lastMonday.setDate(now.getDate() - daysSinceMonday);
  lastMonday.setHours(0, 0, 0, 0);

  const newActionsSinceMonday = await (prisma as any).meetingAction.count({
    where: {
      ...actionWhere,
      status: "OPEN",
      createdAt: { gte: lastMonday },
    },
  });

  return {
    openActions,
    completionRate,
    totalActions,
    newActionsSinceMonday,
    nextMeeting,
  };
}
