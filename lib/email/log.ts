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
