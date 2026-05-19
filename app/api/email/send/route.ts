import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { apiErrorResponse } from "@/lib/apiErrors";
import { sendEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";

const MAX_SUBJECT = 200;
const MAX_MESSAGE = 8000;

export async function POST(req: Request) {
  try {
    const limit = await checkRateLimit(`email-send:${clientIp(req)}`, { max: 30, windowMs: 60_000 });
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many email requests. Try again shortly." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSec ?? 60) } },
      );
    }

    const user = await getSessionUserOrThrow();
    await requireFeature(user.tenantId, "ON_CALL");

    const body = await req.json();
    const to = typeof body.to === "string" ? body.to.trim().toLowerCase() : "";
    const subject = typeof body.subject === "string" ? body.subject.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";

    if (!to || !subject || !message) {
      return NextResponse.json({ error: "to, subject, and message are required" }, { status: 400 });
    }
    if (subject.length > MAX_SUBJECT || message.length > MAX_MESSAGE) {
      return NextResponse.json({ error: "subject or message too long" }, { status: 400 });
    }

    const recipient = await prisma.user.findFirst({
      where: { tenantId: user.tenantId, email: to, isActive: true },
      select: { email: true },
    });
    if (!recipient) {
      return NextResponse.json(
        { error: "Recipient must be an active user in your school" },
        { status: 400 }
      );
    }

    const result = await sendEmail({ to: recipient.email, subject, message });

    if (result.status === "not_configured") {
      return NextResponse.json({ status: "not_configured" }, { status: 202 });
    }

    return NextResponse.json(
      { status: result.status },
      { status: result.status === "sent" ? 200 : 502 }
    );
  } catch (err) {
    return apiErrorResponse(err);
  }
}
