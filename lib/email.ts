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
