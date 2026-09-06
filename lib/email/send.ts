import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import type { EmailDeliveryStatus } from "@prisma/client";
import { logEmailDelivery } from "@/lib/email/log";
import { renderEmailHtml, renderEmailText, type EmailTemplatePayload } from "@/lib/email/templates";

export interface SendEmailOptions {
  to: string;
  subject: string;
  message: string;
  html?: string;
  attachments?: Array<{ filename: string; content: string }>;
  tenantId?: string | null;
  template?: string;
  metadata?: Record<string, unknown>;
}

export interface SendEmailResult {
  status: "sent" | "not_configured" | "failed";
  providerId?: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const {
    to,
    subject,
    message,
    html,
    attachments,
    tenantId = null,
    template = "generic",
    metadata,
  } = options;

  const logStatus = async (status: EmailDeliveryStatus, extra?: { providerId?: string; errorMessage?: string }) => {
    await logEmailDelivery({
      tenantId,
      template,
      to,
      subject,
      status,
      providerId: extra?.providerId,
      errorMessage: extra?.errorMessage,
      metadata,
      bodyText: message,
      bodyHtml: html,
      attachments,
    });
  };

  if (!process.env.RESEND_API_KEY) {
    logger.warn("email.not_configured", { to, subject, template });
    await logStatus("NOT_CONFIGURED");
    return { status: "not_configured" };
  }

  try {
    const body: Record<string, unknown> = {
      from: process.env.FROM_EMAIL || "hi@anaxi.io",
      to: [to],
      subject,
      text: message,
    };
    if (html) body.html = html;
    if (attachments?.length) {
      body.attachments = attachments.map((a) => ({
        filename: a.filename,
        content: Buffer.from(a.content, "utf8").toString("base64"),
      }));
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const responseJson = res.ok
      ? ((await res.json().catch(() => ({}))) as { id?: string })
      : null;

    if (res.ok) {
      const providerId = responseJson?.id;
      logger.info("email.sent", { to, subject, template, providerId });
      await logStatus("SENT", { providerId });
      return { status: "sent", providerId };
    }

    const errorBody =
      typeof res.text === "function" ? await res.text().catch(() => "(unreadable)") : "(unreadable)";
    logger.error("email.failed", { to, subject, template, httpStatus: res.status, errorBody });
    await logStatus("FAILED", { errorMessage: errorBody.slice(0, 500) });
    return { status: "failed" };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error("email.error", { to, subject, template, error: errorMessage });
    await logStatus("FAILED", { errorMessage });
    return { status: "failed" };
  }
}

/** Send using shared HTML + plain-text templates. */
export async function sendTemplatedEmail(options: {
  to: string;
  subject: string;
  schoolName: string;
  tenantId?: string | null;
  template: string;
  payload: EmailTemplatePayload;
  attachments?: Array<{ filename: string; content: string }>;
  metadata?: Record<string, unknown>;
}): Promise<SendEmailResult> {
  const text = renderEmailText({ schoolName: options.schoolName, payload: options.payload });
  const html = renderEmailHtml({
    schoolName: options.schoolName,
    subject: options.subject,
    payload: options.payload,
  });
  return sendEmail({
    to: options.to,
    subject: options.subject,
    message: text,
    html,
    attachments: options.attachments,
    tenantId: options.tenantId,
    template: options.template,
    metadata: options.metadata,
  });
}

/** Create a password-set token for a user (onboarding / invite). */
export async function createPasswordSetToken(userId: string, expiryHours = 72): Promise<string> {
  const crypto = await import("crypto");
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

  await prisma.passwordResetToken.updateMany({
    where: { userId, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });

  await prisma.passwordResetToken.create({
    data: { userId, tokenHash, expiresAt },
  });

  return rawToken;
}

export async function shouldSendUserEmail(
  userId: string,
  kind: "observations" | "meetings" | "leave" | "oncall" | "oncall_first_aid"
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isActive: true,
      emailObservations: true,
      emailMeetings: true,
      emailLeave: true,
      receivesOnCallEmails: true,
      receivesFirstAidEmails: true,
    },
  });
  if (!user?.isActive) return false;
  switch (kind) {
    case "observations":
      return user.emailObservations;
    case "meetings":
      return user.emailMeetings;
    case "leave":
      return user.emailLeave;
    case "oncall":
      return user.receivesOnCallEmails;
    case "oncall_first_aid":
      return user.receivesFirstAidEmails;
    default:
      return true;
  }
}
