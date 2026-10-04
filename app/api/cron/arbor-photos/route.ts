import { NextResponse } from "next/server";
import { assertCronAuthorized } from "@/lib/cronAuth";
export async function GET(req: Request) {
  const denied = assertCronAuthorized(req); if (denied) return denied;
  // A protected GitHub workflow can request a photo-only catch-up outside 2am.
  // This is intentionally unavailable to ordinary browser requests.
  const force = new URL(req.url).searchParams.get("force") === "1";
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date()).find((part) => part.type === "hour")?.value);
  if (hour !== 2 && !force) return NextResponse.json({ skipped: "outside 2am Europe/London" });
  const response = await fetch(new URL("/api/god/integrations/arbor/sync/photos", req.url), { method: "POST", headers: { Authorization: req.headers.get("authorization") ?? "", "x-arbor-scheduled-sync": "1" }, redirect: "manual" });
  return response.ok ? NextResponse.json({ scheduled: true }) : NextResponse.json({ error: "Arbor photo sync failed" }, { status: 500 });
}
