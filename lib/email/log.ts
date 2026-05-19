import { prisma } from "@/lib/prisma";
import type { EmailDeliveryStatus, Prisma } from "@prisma/client";

export async function logEmailDelivery(options: {
  tenantId?: string | null;
  template: string;
  to: string;
  subject: string;
  status: EmailDeliveryStatus;
  providerId?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    await prisma.emailLog.create({
      data: {
        tenantId: options.tenantId ?? null,
        template: options.template,
        toEmail: options.to,
        subject: options.subject,
        status: options.status,
        providerId: options.providerId ?? null,
        errorMessage: options.errorMessage ?? null,
        metadataJson: (options.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  } catch {
    // Logging must not break sends
  }
}

/** Update delivery status from Resend webhooks (matched by provider message id). */
export async function updateEmailLogByProviderId(
  providerId: string,
  status: EmailDeliveryStatus,
  errorMessage?: string | null,
): Promise<boolean> {
  try {
    const result = await prisma.emailLog.updateMany({
      where: { providerId },
      data: {
        status,
        ...(errorMessage !== undefined ? { errorMessage } : {}),
      },
    });
    return result.count > 0;
  } catch {
    return false;
  }
}
