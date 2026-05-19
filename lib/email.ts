import { getAppUrl, formatDateRange, formatDateTime, getTenantEmailBranding } from "@/lib/email/format";
import { buildMeetingIcs } from "@/lib/email/ics";
import {
  createPasswordSetToken,
  sendEmail,
  sendTemplatedEmail,
  shouldSendUserEmail,
  type SendEmailResult,
} from "@/lib/email/send";

export type { SendEmailOptions, SendEmailResult } from "@/lib/email/send";
export { sendEmail, shouldSendUserEmail, createPasswordSetToken };

/**
 * Build and send an onboarding email with a set-password link.
 */
export async function sendOnboardingEmail(options: {
  to: string;
  fullName: string;
  tenantId: string;
  userId: string;
  tenantName?: string;
}): Promise<SendEmailResult> {
  const { to, fullName, tenantId, userId } = options;
  const branding = await getTenantEmailBranding(tenantId);
  const schoolName = options.tenantName ?? branding.schoolName;
  const token = await createPasswordSetToken(userId, 72);
  const setPasswordUrl = `${getAppUrl()}/login/reset-password?token=${token}`;
  const loginUrl = `${getAppUrl()}/login`;

  return sendTemplatedEmail({
    to,
    subject: `Welcome to ${schoolName} on Anaxi`,
    schoolName,
    tenantId,
    template: "onboarding",
    metadata: { userId },
    payload: {
      preheader: `Set your password to join ${schoolName}`,
      greeting: `Hi ${fullName},`,
      lines: [
        `You have been added to ${schoolName} on Anaxi.`,
        "Set your password using the button below, then sign in with your school email.",
        `Sign-in page: ${loginUrl}`,
      ],
      cta: { label: "Set your password", href: setPasswordUrl },
    },
  });
}

export async function sendObservationEmail(options: {
  to: string;
  teacherName: string;
  observerName: string;
  observationId: string;
  tenantId: string;
  teacherUserId: string;
}): Promise<SendEmailResult> {
  if (!(await shouldSendUserEmail(options.teacherUserId, "observations"))) {
    return { status: "sent" };
  }

  const branding = await getTenantEmailBranding(options.tenantId);
  const viewUrl = `${getAppUrl()}/observe/${options.observationId}`;

  return sendTemplatedEmail({
    to: options.to,
    subject: `New observation from ${options.observerName}`,
    schoolName: branding.schoolName,
    tenantId: options.tenantId,
    template: "observation",
    metadata: { observationId: options.observationId },
    payload: {
      greeting: `Hi ${options.teacherName},`,
      lines: [
        `${options.observerName} has submitted a classroom observation for you.`,
        "Open Anaxi to read the full feedback and signals.",
      ],
      cta: { label: "View observation", href: viewUrl },
    },
  });
}

export async function sendMeetingInviteEmail(options: {
  to: string;
  attendeeName: string;
  title: string;
  startDateTime: Date;
  endDateTime: Date;
  meetingId: string;
  tenantId: string;
  attendeeUserId: string;
  location?: string | null;
  organizerEmail: string;
  organizerName: string;
}): Promise<SendEmailResult> {
  if (!(await shouldSendUserEmail(options.attendeeUserId, "meetings"))) {
    return { status: "sent" };
  }

  const branding = await getTenantEmailBranding(options.tenantId);
  const when = formatDateTime(options.startDateTime, branding.timezone);
  const meetingUrl = `${getAppUrl()}/meetings/${options.meetingId}`;
  const locationLine = options.location ? `Location: ${options.location}` : "";

  const ics = buildMeetingIcs({
    uid: `${options.meetingId}@anaxi`,
    title: options.title,
    description: `Meeting in Anaxi: ${meetingUrl}`,
    location: options.location ?? undefined,
    start: options.startDateTime,
    end: options.endDateTime,
    organizerEmail: options.organizerEmail,
    organizerName: options.organizerName,
    attendeeEmail: options.to,
    attendeeName: options.attendeeName,
  });

  return sendTemplatedEmail({
    to: options.to,
    subject: `Meeting invite: ${options.title}`,
    schoolName: branding.schoolName,
    tenantId: options.tenantId,
    template: "meeting_invite",
    metadata: { meetingId: options.meetingId },
    payload: {
      greeting: `Hi ${options.attendeeName},`,
      lines: [
        `You have been invited to: ${options.title}`,
        `When: ${when} (${branding.timezone})`,
        ...(locationLine ? [locationLine] : []),
        "A calendar file is attached — open it to add this meeting to your diary.",
      ],
      cta: { label: "View meeting", href: meetingUrl },
    },
    attachments: [{ filename: "invite.ics", content: ics }],
  });
}

export async function sendLeaveDecisionEmail(options: {
  to: string;
  requesterName: string;
  status: "APPROVED_WITH_PAY" | "APPROVED_WITHOUT_PAY" | "DENIED";
  leaveRequestId: string;
  tenantId: string;
  requesterUserId: string;
}): Promise<SendEmailResult> {
  if (!(await shouldSendUserEmail(options.requesterUserId, "leave"))) {
    return { status: "sent" };
  }

  const branding = await getTenantEmailBranding(options.tenantId);
  const statusLabel =
    options.status === "APPROVED_WITH_PAY"
      ? "approved with pay"
      : options.status === "APPROVED_WITHOUT_PAY"
        ? "approved without pay"
        : "denied";
  const leaveUrl = `${getAppUrl()}/leave/${options.leaveRequestId}`;

  return sendTemplatedEmail({
    to: options.to,
    subject: `Your leave request has been ${statusLabel}`,
    schoolName: branding.schoolName,
    tenantId: options.tenantId,
    template: "leave_decision",
    metadata: { leaveRequestId: options.leaveRequestId, status: options.status },
    payload: {
      greeting: `Hi ${options.requesterName},`,
      lines: [`Your leave of absence request has been ${statusLabel}.`],
      cta: { label: "View request", href: leaveUrl },
    },
  });
}

export async function sendLeaveSubmittedEmail(options: {
  to: string[];
  requesterName: string;
  reasonLabel: string;
  startDate: Date;
  endDate: Date;
  leaveRequestId: string;
  tenantId: string;
  approverUserIds: string[];
}): Promise<SendEmailResult> {
  const branding = await getTenantEmailBranding(options.tenantId);
  const dates = formatDateRange(options.startDate, options.endDate, branding.timezone);
  const reviewUrl = `${getAppUrl()}/leave/${options.leaveRequestId}`;
  const subject = `Leave request from ${options.requesterName} needs review`;

  const results: SendEmailResult[] = [];
  for (let i = 0; i < options.to.length; i++) {
    const to = options.to[i];
    const userId = options.approverUserIds[i];
    if (userId && !(await shouldSendUserEmail(userId, "leave"))) continue;

    results.push(
      await sendTemplatedEmail({
        to,
        subject,
        schoolName: branding.schoolName,
        tenantId: options.tenantId,
        template: "leave_submitted",
        metadata: { leaveRequestId: options.leaveRequestId },
        payload: {
          lines: [
            "A new leave of absence request has been submitted.",
            `Staff member: ${options.requesterName}`,
            `Reason: ${options.reasonLabel}`,
            `Dates: ${dates}`,
          ],
          cta: { label: "Review request", href: reviewUrl },
        },
      })
    );
  }

  if (results.some((r) => r.status === "sent")) return { status: "sent" };
  if (results.every((r) => r.status === "not_configured")) return { status: "not_configured" };
  return { status: "failed" };
}

export async function sendSchoolAdminInviteEmail(options: {
  to: string;
  fullName: string;
  tenantId: string;
  tenantName: string;
  inviteToken: string;
}): Promise<SendEmailResult> {
  const inviteUrl = `${getAppUrl()}/invite/${options.inviteToken}`;

  return sendTemplatedEmail({
    to: options.to,
    subject: `You're invited to administer ${options.tenantName} on Anaxi`,
    schoolName: options.tenantName,
    tenantId: options.tenantId,
    template: "school_admin_invite",
    payload: {
      preheader: "Accept your school admin invite",
      greeting: `Hi ${options.fullName},`,
      lines: [
        `You have been invited to set up ${options.tenantName} as a school administrator on Anaxi.`,
        "This link expires in 7 days and can only be used once.",
      ],
      cta: { label: "Accept invite", href: inviteUrl },
    },
  });
}

export async function sendMeetingUpdatedEmail(options: {
  to: string;
  attendeeName: string;
  title: string;
  startDateTime: Date;
  endDateTime: Date;
  meetingId: string;
  tenantId: string;
  attendeeUserId: string;
  location?: string | null;
}): Promise<SendEmailResult> {
  if (!(await shouldSendUserEmail(options.attendeeUserId, "meetings"))) {
    return { status: "sent" };
  }

  const branding = await getTenantEmailBranding(options.tenantId);
  const when = formatDateTime(options.startDateTime, branding.timezone);
  const meetingUrl = `${getAppUrl()}/meetings/${options.meetingId}`;
  const locationLine = options.location ? `Location: ${options.location}` : "";

  return sendTemplatedEmail({
    to: options.to,
    subject: `Meeting updated: ${options.title}`,
    schoolName: branding.schoolName,
    tenantId: options.tenantId,
    template: "meeting_updated",
    metadata: { meetingId: options.meetingId },
    payload: {
      greeting: `Hi ${options.attendeeName},`,
      lines: [
        `The meeting "${options.title}" has been updated.`,
        `When: ${when} (${branding.timezone})`,
        ...(locationLine ? [locationLine] : []),
      ],
      cta: { label: "View meeting", href: meetingUrl },
    },
  });
}

export async function sendMeetingCancelledEmail(options: {
  to: string;
  attendeeName: string;
  title: string;
  startDateTime: Date;
  meetingId: string;
  tenantId: string;
  attendeeUserId: string;
}): Promise<SendEmailResult> {
  if (!(await shouldSendUserEmail(options.attendeeUserId, "meetings"))) {
    return { status: "sent" };
  }

  const branding = await getTenantEmailBranding(options.tenantId);
  const when = formatDateTime(options.startDateTime, branding.timezone);

  return sendTemplatedEmail({
    to: options.to,
    subject: `Meeting cancelled: ${options.title}`,
    schoolName: branding.schoolName,
    tenantId: options.tenantId,
    template: "meeting_cancelled",
    metadata: { meetingId: options.meetingId },
    payload: {
      greeting: `Hi ${options.attendeeName},`,
      lines: [
        `The meeting "${options.title}" scheduled for ${when} has been cancelled.`,
        "No further action is required.",
      ],
    },
  });
}

export async function sendLeavePendingReminderEmail(options: {
  to: string;
  approverName: string;
  requesterName: string;
  reasonLabel: string;
  startDate: Date;
  endDate: Date;
  leaveRequestId: string;
  tenantId: string;
  approverUserId: string;
}): Promise<SendEmailResult> {
  if (!(await shouldSendUserEmail(options.approverUserId, "leave"))) {
    return { status: "sent" };
  }

  const branding = await getTenantEmailBranding(options.tenantId);
  const dates = formatDateRange(options.startDate, options.endDate, branding.timezone);
  const reviewUrl = `${getAppUrl()}/leave/${options.leaveRequestId}`;

  return sendTemplatedEmail({
    to: options.to,
    subject: `Reminder: leave request from ${options.requesterName}`,
    schoolName: branding.schoolName,
    tenantId: options.tenantId,
    template: "leave_reminder",
    metadata: { leaveRequestId: options.leaveRequestId },
    payload: {
      greeting: `Hi ${options.approverName},`,
      lines: [
        "This leave request is still awaiting a decision.",
        `Staff member: ${options.requesterName}`,
        `Reason: ${options.reasonLabel}`,
        `Dates: ${dates}`,
      ],
      cta: { label: "Review request", href: reviewUrl },
    },
  });
}

export async function sendPasswordResetEmail(options: {
  to: string;
  fullName: string;
  resetUrl: string;
  tenantId?: string | null;
}): Promise<SendEmailResult> {
  return sendTemplatedEmail({
    to: options.to,
    subject: "Reset your Anaxi password",
    schoolName: "Anaxi",
    tenantId: options.tenantId ?? null,
    template: "password_reset",
    payload: {
      greeting: `Hi ${options.fullName},`,
      lines: [
        "You requested a password reset for your Anaxi account.",
        "This link is valid for 1 hour.",
        "If you did not request this, you can ignore this email.",
      ],
      cta: { label: "Reset password", href: options.resetUrl },
    },
  });
}
