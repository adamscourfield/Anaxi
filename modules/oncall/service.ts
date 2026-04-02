import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { OnCallRequestInput, AcknowledgeOnCallInput, ResolveOnCallInput } from "./types";

const REQUEST_INCLUDE = {
  requester: { select: { id: true, fullName: true, email: true } },
  student: { select: { id: true, fullName: true, upn: true, yearGroup: true } },
  responder: { select: { id: true, fullName: true } },
};

export async function createOnCallRequest(
  tenantId: string,
  requesterUserId: string,
  input: OnCallRequestInput
) {
  if (!input.studentId) throw new Error("studentId required");
  if (!input.location) throw new Error("location required");
  if (input.requestType === "BEHAVIOUR" && !input.behaviourReasonCategory) {
    throw new Error("behaviourReasonCategory required for BEHAVIOUR type");
  }

  const student = await (prisma as any).student.findFirst({
    where: { id: input.studentId, tenantId },
  });
  if (!student) throw new Error("student not found");

  const created = await (prisma as any).onCallRequest.create({
    data: {
      tenantId,
      requesterUserId,
      studentId: input.studentId,
      requestType: input.requestType,
      isEmergency: Boolean(input.isEmergency),
      location: input.location,
      behaviourReasonCategory: input.behaviourReasonCategory ?? null,
      notes: input.notes ?? null,
      status: "OPEN",
    },
    include: REQUEST_INCLUDE,
  });

  logger.info("oncall.created", { tenantId, requestId: created.id, requesterUserId });
  return created;
}

export async function acknowledgeOnCallRequest(
  requestId: string,
  tenantId: string,
  responderId: string,
  _input: AcknowledgeOnCallInput = {}
) {
  const existing = await (prisma as any).onCallRequest.findFirst({
    where: { id: requestId, tenantId },
  });
  if (!existing) throw new Error("request not found");

  const updated = await (prisma as any).onCallRequest.updateMany({
    where: { id: requestId, tenantId, status: "OPEN" },
    data: {
      status: "ACKNOWLEDGED",
      responderUserId: responderId,
      acknowledgedAt: new Date(),
    },
  });

  if (updated.count !== 1) throw new Error("request is not OPEN");

  logger.info("oncall.acknowledged", { tenantId, requestId, responderId });
  return (prisma as any).onCallRequest.findFirst({
    where: { id: requestId, tenantId },
    include: REQUEST_INCLUDE,
  });
}

export async function resolveOnCallRequest(
  requestId: string,
  tenantId: string,
  responderId: string,
  _input: ResolveOnCallInput = {}
) {
  const existing = await (prisma as any).onCallRequest.findFirst({
    where: { id: requestId, tenantId },
    select: { status: true, responderUserId: true },
  });
  if (!existing) throw new Error("request not found");

  const updated = await (prisma as any).onCallRequest.updateMany({
    where: { id: requestId, tenantId, status: { in: ["OPEN", "ACKNOWLEDGED"] } },
    data: {
      status: "RESOLVED",
      responderUserId: existing.responderUserId ?? responderId,
      resolvedAt: new Date(),
    },
  });

  if (updated.count !== 1) {
    if (existing.status === "RESOLVED") throw new Error("request already resolved");
    throw new Error("request is cancelled");
  }

  logger.info("oncall.resolved", { tenantId, requestId, responderId });
  return (prisma as any).onCallRequest.findFirst({
    where: { id: requestId, tenantId },
    include: REQUEST_INCLUDE,
  });
}

export async function cancelOnCallRequest(
  requestId: string,
  tenantId: string,
  userId: string
) {
  const existing = await (prisma as any).onCallRequest.findFirst({
    where: { id: requestId, tenantId },
    select: { requesterUserId: true },
  });
  if (!existing) throw new Error("request not found");
  if (existing.requesterUserId !== userId) throw new Error("only the requester can cancel");

  const updated = await (prisma as any).onCallRequest.updateMany({
    where: { id: requestId, tenantId, requesterUserId: userId, status: "OPEN" },
    data: { status: "CANCELLED" },
  });
  if (updated.count !== 1) throw new Error("only OPEN requests can be cancelled");

  logger.info("oncall.cancelled", { tenantId, requestId, userId });
  return (prisma as any).onCallRequest.findFirst({
    where: { id: requestId, tenantId },
    include: REQUEST_INCLUDE,
  });
}

export async function getOpenRequests(tenantId: string) {
  return (prisma as any).onCallRequest.findMany({
    where: { tenantId, status: "OPEN" },
    include: REQUEST_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
}

export async function getRequestsByStatus(
  tenantId: string,
  status?: string,
  take = 50,
  skip = 0
) {
  const where: Record<string, unknown> = { tenantId };
  if (status) where.status = status;

  const [data, total] = await Promise.all([
    (prisma as any).onCallRequest.findMany({
      where,
      include: REQUEST_INCLUDE,
      orderBy: { createdAt: "desc" },
      take,
      skip,
    }),
    (prisma as any).onCallRequest.count({ where }),
  ]);

  return { data, total };
}

export async function getRequestDetail(tenantId: string, requestId: string) {
  const request = await (prisma as any).onCallRequest.findFirst({
    where: { id: requestId, tenantId },
    include: REQUEST_INCLUDE,
  });
  if (!request) throw new Error("request not found");
  return request;
}

export async function getResponderInbox(tenantId: string, responderId: string) {
  return (prisma as any).onCallRequest.findMany({
    where: {
      tenantId,
      status: { in: ["OPEN", "ACKNOWLEDGED"] },
    },
    include: REQUEST_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
}
