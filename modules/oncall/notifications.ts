import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { getTenantEmailBranding, getAppUrl } from "@/lib/email/format";
import { sendTemplatedEmail } from "@/lib/email/send";
import { shouldSendUserEmail } from "@/lib/email/send";

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
    const isFirstAid = request.requestType === "FIRST_AID";
    const emailKind = isFirstAid ? "oncall_first_aid" : "oncall";
    const [recipients, extraRecipients] = await Promise.all([
      prisma.user.findMany({
        where: {
          tenantId,
          isActive: true,
          ...(isFirstAid ? { receivesFirstAidEmails: true } : { receivesOnCallEmails: true }),
        },
        select: { id: true, email: true, fullName: true },
      }),
      // Additional recipients configured in Admin → Taxonomies -- each must
      // be a real staff user (never a bare email address), and opts into
      // behaviour and/or first-aid notifications independently, same as the
      // per-user flags above.
      (prisma as any).onCallRecipient.findMany({
        where: {
          tenantId,
          active: true,
          ...(isFirstAid ? { notifiesFirstAid: true } : { notifiesBehaviour: true }),
          user: { isActive: true },
        },
        select: { user: { select: { id: true, email: true, fullName: true } } },
      }) as Promise<{ user: { id: string; email: string; fullName: string } }[]>,
    ]);

    // A user opted in via their own profile might also be listed as a
    // Taxonomies recipient -- avoid emailing them twice for the same event.
    const recipientIds = new Set(recipients.map((r) => r.id));
    const dedupedExtraRecipients = extraRecipients
      .map((r) => r.user)
      .filter((u) => !recipientIds.has(u.id));

    if (recipients.length === 0 && dedupedExtraRecipients.length === 0) return;

    const branding = await getTenantEmailBranding(tenantId);
    const requestUrl = `${getAppUrl()}/on-call/${request.id}`;
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
    const lines = [
      introMap[type],
      `Request type: ${requestTypeLabel}`,
      `Status: ${request.status}`,
      ...(request.isEmergency ? ["", "EMERGENCY — please respond urgently."] : []),
    ];

    await Promise.allSettled([
      ...recipients.map(async (recipient) => {
        if (!(await shouldSendUserEmail(recipient.id, emailKind))) return;
        return sendTemplatedEmail({
          to: recipient.email,
          subject,
          schoolName: branding.schoolName,
          tenantId,
          template: `oncall_${type}`,
          metadata: { requestId: request.id },
          payload: {
            greeting: `Hi ${recipient.fullName},`,
            lines,
            cta: { label: "View request", href: requestUrl },
          },
        });
      }),
      ...dedupedExtraRecipients.map((recipient) =>
        sendTemplatedEmail({
          to: recipient.email,
          subject,
          schoolName: branding.schoolName,
          tenantId,
          template: `oncall_${type}`,
          metadata: { requestId: request.id },
          payload: {
            greeting: `Hi ${recipient.fullName},`,
            lines,
            cta: { label: "View request", href: requestUrl },
          },
        })
      ),
    ]);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error("[OnCall] notification error", { requestId: request.id, error: errorMessage });
  }
}
