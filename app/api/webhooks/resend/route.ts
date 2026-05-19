import { NextResponse } from "next/server";
import { verifyResendWebhook } from "@/lib/resendWebhook";
import { updateEmailLogByProviderId } from "@/lib/email/log";
import type { EmailDeliveryStatus } from "@prisma/client";

type ResendWebhookEvent = {
  type?: string;
  data?: { email_id?: string; error?: { message?: string } };
};

function mapEventType(type: string): EmailDeliveryStatus | null {
  switch (type) {
    case "email.delivered":
      return "SENT";
    case "email.bounced":
    case "email.complained":
    case "email.delivery_delayed":
      return "FAILED";
    default:
      return null;
  }
}

export async function POST(req: Request) {
  const rawBody = await req.text();

  try {
    verifyResendWebhook(rawBody, req.headers);
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let payload: ResendWebhookEvent;
  try {
    payload = JSON.parse(rawBody) as ResendWebhookEvent;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const eventType = payload.type ?? "";
  const providerId = payload.data?.email_id;
  if (!providerId) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const status = mapEventType(eventType);
  if (!status) {
    return NextResponse.json({ ok: true, ignored: eventType });
  }

  const errorMessage =
    status === "FAILED"
      ? payload.data?.error?.message ?? eventType
      : null;

  const updated = await updateEmailLogByProviderId(providerId, status, errorMessage);
  return NextResponse.json({ ok: true, updated });
}
