import { Webhook } from "svix";
import { requireEnv } from "@/lib/env";

export function verifyResendWebhook(
  rawBody: string,
  headers: Headers,
): void {
  const secret = requireEnv("RESEND_WEBHOOK_SECRET") ?? process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("RESEND_WEBHOOK_SECRET not configured");
  }

  const wh = new Webhook(secret);
  wh.verify(rawBody, {
    "svix-id": headers.get("svix-id") ?? "",
    "svix-timestamp": headers.get("svix-timestamp") ?? "",
    "svix-signature": headers.get("svix-signature") ?? "",
  });
}
