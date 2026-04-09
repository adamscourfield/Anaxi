import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

export async function sendOnCallNotification(
  tenantId: string,
  request: {
    id: string;
    requestType: string;
    status: string;
    isEmergency?: boolean;
    student?: { fullName?: string } | null;
  },
  type: "created" | "acknowledged" | "resolved"
) {
  const studentName = request.student?.fullName ?? "Unknown";
  logger.info(`[OnCall] ${type.toUpperCase()}`, {
    requestId: request.id,
    student: studentName,
    requestType: request.requestType,
    status: request.status,
    isEmergency: Boolean(request.isEmergency),
  });

  try {
    const recipients = await prisma.user.findMany({
      where: { tenantId, receivesOnCallEmails: true, isActive: true },
      select: { email: true, fullName: true },
    });

    if (recipients.length === 0) return;

    const appUrl = process.env.NEXTAUTH_URL || process.env.APP_URL || "http://localhost:3000";
    const requestUrl = `${appUrl}/on-call/${request.id}`;
    const requestTypeLabel = request.requestType === "FIRST_AID" ? "First Aid" : "Behaviour";
    const emergencyFlag = request.isEmergency ? " [EMERGENCY]" : "";

    const subjectMap: Record<typeof type, string> = {
      created: `On-call request created${emergencyFlag}: ${requestTypeLabel} – ${studentName}`,
      acknowledged: `On-call request acknowledged${emergencyFlag}: ${requestTypeLabel} – ${studentName}`,
      resolved: `On-call request resolved${emergencyFlag}: ${requestTypeLabel} – ${studentName}`,
    };

    const introMap: Record<typeof type, string> = {
      created: `A new on-call request has been raised for ${studentName}.`,
      acknowledged: `The on-call request for ${studentName} has been acknowledged.`,
      resolved: `The on-call request for ${studentName} has been resolved.`,
    };

    const subject = subjectMap[type];
    const intro = introMap[type];

    await Promise.allSettled(
      recipients.map((recipient) => {
        const message = [
          `Hi ${recipient.fullName},`,
          "",
          intro,
          "",
          `Request type: ${requestTypeLabel}`,
          `Status: ${request.status}`,
          ...(request.isEmergency ? ["", "** EMERGENCY **"] : []),
          "",
          "View the full request here:",
          "",
          requestUrl,
          "",
          "– The Anaxi Team",
        ].join("\n");

        return sendEmail({ to: recipient.email, subject, message });
      })
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error("[OnCall] notification error", { requestId: request.id, error: errorMessage });
  }
}
