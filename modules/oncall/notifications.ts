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
      // Standing recipients configured in Admin → Taxonomies (e.g. a shared
      // pastoral inbox) who aren't necessarily system users.
      (prisma as any).onCallRecipient.findMany({
        where: { tenantId, active: true },
        select: { email: true },
      }) as Promise<{ email: string }[]>,
    ]);

    if (recipients.length === 0 && extraRecipients.length === 0) return;

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
      ...extraRecipients.map((recipient) =>
        sendTemplatedEmail({
          to: recipient.email,
          subject,
          schoolName: branding.schoolName,
          tenantId,
          template: `oncall_${type}`,
          metadata: { requestId: request.id },
          payload: {
            greeting: "Hi,",
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
