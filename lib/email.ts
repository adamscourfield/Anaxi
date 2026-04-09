import { logger } from "@/lib/logger";

export interface SendEmailOptions {
  to: string;
  subject: string;
  message: string;
}

export interface SendEmailResult {
  status: "sent" | "not_configured" | "failed";
}

/**
 * Send an email via the Resend API.
 *
 * Returns `{ status: "not_configured" }` when `RESEND_API_KEY` is not set,
 * allowing development and tests to proceed without a real mail provider.
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const { to, subject, message } = options;

  if (!process.env.RESEND_API_KEY) {
    logger.warn("email.not_configured", { to, subject });
    return { status: "not_configured" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.FROM_EMAIL || "hi@anaxi.io",
        to: [to],
        subject,
        text: message,
      }),
    });

    if (res.ok) {
      logger.info("email.sent", { to, subject });
      return { status: "sent" };
    }

    logger.error("email.failed", { to, subject, httpStatus: res.status });
    return { status: "failed" };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error("email.error", { to, subject, error: errorMessage });
    return { status: "failed" };
  }
}

/**
 * Build and send an onboarding email for a newly imported staff member.
 */
export async function sendOnboardingEmail(options: {
  to: string;
  fullName: string;
  tenantName?: string;
}): Promise<SendEmailResult> {
  const { to, fullName, tenantName } = options;
  const schoolName = tenantName ?? "your school";

  const subject = `Welcome to ${schoolName} on Anaxi`;
  const message = [
    `Hi ${fullName},`,
    "",
    `You have been added to ${schoolName} on Anaxi.`,
    "",
    "You can log in at any time to access your dashboard, view meetings, and more.",
    "",
    "If you have any questions, please reach out to your school administrator.",
    "",
    "– The Anaxi Team",
  ].join("\n");

  return sendEmail({ to, subject, message });
}

/**
 * Build and send an email notifying a teacher that they have received an observation.
 */
export async function sendObservationEmail(options: {
  to: string;
  teacherName: string;
  observerName: string;
  observationId: string;
}): Promise<SendEmailResult> {
  const { to, teacherName, observerName, observationId } = options;
  const appUrl = process.env.NEXTAUTH_URL || process.env.APP_URL || "http://localhost:3000";

  const subject = `New observation from ${observerName}`;
  const message = [
    `Hi ${teacherName},`,
    "",
    `${observerName} has submitted a classroom observation for you.`,
    "",
    "You can view the full observation here:",
    "",
    `${appUrl}/observe/${observationId}`,
    "",
    "If you have any questions, please contact your line manager.",
    "",
    "– The Anaxi Team",
  ].join("\n");

  return sendEmail({ to, subject, message });
}

/**
 * Build and send a meeting invite email to an attendee.
 */
export async function sendMeetingInviteEmail(options: {
  to: string;
  attendeeName: string;
  title: string;
  startDateTime: Date;
  meetingId: string;
}): Promise<SendEmailResult> {
  const { to, attendeeName, title, startDateTime, meetingId } = options;
  const appUrl = process.env.NEXTAUTH_URL || process.env.APP_URL || "http://localhost:3000";

  const formattedDate = startDateTime.toLocaleString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });

  const subject = `Meeting invite: ${title}`;
  const message = [
    `Hi ${attendeeName},`,
    "",
    `You have been invited to: ${title}`,
    "",
    `When: ${formattedDate}`,
    "",
    "View the meeting details here:",
    "",
    `${appUrl}/meetings/${meetingId}`,
    "",
    "– The Anaxi Team",
  ].join("\n");

  return sendEmail({ to, subject, message });
}

/**
 * Build and send an email notifying a staff member of the decision on their leave request.
 */
export async function sendLeaveDecisionEmail(options: {
  to: string;
  requesterName: string;
  status: "APPROVED_WITH_PAY" | "APPROVED_WITHOUT_PAY" | "DENIED";
  leaveRequestId: string;
}): Promise<SendEmailResult> {
  const { to, requesterName, status, leaveRequestId } = options;
  const appUrl = process.env.NEXTAUTH_URL || process.env.APP_URL || "http://localhost:3000";

  const statusLabel =
    status === "APPROVED_WITH_PAY"
      ? "approved with pay"
      : status === "APPROVED_WITHOUT_PAY"
        ? "approved without pay"
        : "denied";

  const subject = `Your leave request has been ${statusLabel}`;
  const message = [
    `Hi ${requesterName},`,
    "",
    `Your leave of absence request has been ${statusLabel}.`,
    "",
    "You can view the full details here:",
    "",
    `${appUrl}/leave/${leaveRequestId}`,
    "",
    "If you have any questions, please contact your line manager.",
    "",
    "– The Anaxi Team",
  ].join("\n");

  return sendEmail({ to, subject, message });
}
