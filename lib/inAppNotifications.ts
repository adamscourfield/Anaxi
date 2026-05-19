import { prisma } from "@/lib/prisma";

export async function createInAppNotification(options: {
  tenantId: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  href?: string | null;
}) {
  try {
    return await prisma.inAppNotification.create({
      data: {
        tenantId: options.tenantId,
        userId: options.userId,
        type: options.type,
        title: options.title,
        body: options.body,
        href: options.href ?? null,
      },
    });
  } catch {
    return null;
  }
}

export async function listUnreadNotifications(userId: string, limit = 20) {
  return prisma.inAppNotification.findMany({
    where: { userId, readAt: null },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function countUnreadNotifications(userId: string) {
  return prisma.inAppNotification.count({
    where: { userId, readAt: null },
  });
}

export async function markNotificationRead(userId: string, notificationId: string) {
  return prisma.inAppNotification.updateMany({
    where: { id: notificationId, userId },
    data: { readAt: new Date() },
  });
}

export async function markAllNotificationsRead(userId: string) {
  return prisma.inAppNotification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function notifyImportFinished(options: {
  tenantId: string;
  userId: string;
  importJobId: string;
  fileName: string;
  rowsFailed: number;
}) {
  const status = options.rowsFailed === 0 ? "completed" : "finished with errors";
  await createInAppNotification({
    tenantId: options.tenantId,
    userId: options.userId,
    type: "import_finished",
    title: "Student import finished",
    body: `${options.fileName} ${status}.`,
    href: "/admin/imports",
  });
}

export async function notifyLeaveReviewers(options: {
  tenantId: string;
  approverUserIds: string[];
  requesterName: string;
  leaveRequestId: string;
}) {
  for (const userId of options.approverUserIds) {
    await createInAppNotification({
      tenantId: options.tenantId,
      userId,
      type: "leave_pending",
      title: "Leave request needs review",
      body: `${options.requesterName} submitted a leave request.`,
      href: `/leave/${options.leaveRequestId}`,
    });
  }
}
