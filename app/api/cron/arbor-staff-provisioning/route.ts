import { NextResponse } from "next/server";
import { assertCronAuthorized } from "@/lib/cronAuth";

function londonHour(): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date()).find((part) => part.type === "hour")?.value);
}

/** Adds new Arbor staff to the review queue; it never creates an account by itself. */
export async function GET(req: Request) {
  const denied = assertCronAuthorized(req); if (denied) return denied;
  if (londonHour() !== 2) return NextResponse.json({ skipped: "outside 2am Europe/London" });
  const response = await fetch(new URL("/api/god/integrations/arbor/staff/provisioning", req.url), { method: "POST", headers: { Authorization: req.headers.get("authorization") ?? "", "x-arbor-scheduled-sync": "1" } });
  return NextResponse.json(await response.json(), { status: response.status });
}
