import { NextResponse } from "next/server";
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
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (secret) {
    const provided = req.headers.get("resend-signature") || req.headers.get("x-resend-signature");
    if (provided !== secret) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  let payload: ResendWebhookEvent;
  try {
    payload = (await req.json()) as ResendWebhookEvent;
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
