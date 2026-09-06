"use server";
import { assertSafeServerAction } from "@/lib/serverActionGuard";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { requireAdminUser } from "@/lib/admin";
import { adminSectionPath } from "@/lib/admin-sections";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function resendEmail(formData: FormData): Promise<ActionResult> {
  try {
    await assertSafeServerAction(formData);
    const admin = await requireAdminUser();
    const id = String(formData.get("id") || "");
    if (!id) throw new Error("Email is required.");

    const log = await prisma.emailLog.findFirst({
      where: { id, tenantId: admin.tenantId },
    });
    if (!log) throw new Error("Email not found.");
    if (log.status !== "FAILED") throw new Error("Only failed emails can be resent.");
    if (log.bodyText == null) {
      throw new Error("This email was logged before resending was supported and can't be resent.");
    }

    const attachments = Array.isArray(log.attachmentsJson)
      ? (log.attachmentsJson as unknown as Array<{ filename: string; content: string }>)
      : undefined;

    const result = await sendEmail({
      to: log.toEmail,
      subject: log.subject,
      message: log.bodyText,
      html: log.bodyHtml ?? undefined,
      attachments,
      tenantId: log.tenantId,
      template: log.template,
      metadata: (log.metadataJson as Record<string, unknown> | null) ?? undefined,
    });

    revalidatePath(adminSectionPath("email-log"));

    if (result.status === "failed") {
      throw new Error("Resend attempted but failed again — see the new entry below for details.");
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong. Please try again." };
  }
}
