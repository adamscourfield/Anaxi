import { NextResponse } from "next/server";
import { assertCronAuthorized } from "@/lib/cronAuth";
import { sendLeavePendingReminderEmail } from "@/lib/email";
import { loaApproversForRequest } from "@/lib/loa";
import { prisma } from "@/lib/prisma";

/** Cron: remind approvers about PENDING leave requests older than 48 hours. */
export async function POST(req: Request) {
  const denied = assertCronAuthorized(req);
  if (denied) return denied;

  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const pending = await prisma.lOARequest.findMany({
    where: {
      status: "PENDING",
      createdAt: { lte: cutoff },
    },
    include: {
      requester: { select: { id: true, fullName: true } },
      reason: { select: { label: true } },
    },
    take: 100,
  });

  let remindersSent = 0;
  for (const request of pending) {
    const approvers = await loaApproversForRequest(request.tenantId, request.requesterId);
    for (const approver of approvers) {
      const result = await sendLeavePendingReminderEmail({
        to: approver.email,
        approverName: approver.fullName,
        requesterName: request.requester.fullName,
        reasonLabel: request.reason?.label ?? "Leave request",
        startDate: request.startDate,
        endDate: request.endDate,
        leaveRequestId: request.id,
        tenantId: request.tenantId,
        approverUserId: approver.id,
      });
      if (result.status === "sent") remindersSent++;
    }
  }

  return NextResponse.json({
    checked: pending.length,
    remindersSent,
    checkedAt: new Date().toISOString(),
  });
}

/** Vercel Cron always triggers via GET. */
export const GET = POST;
