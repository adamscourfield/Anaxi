import { NextResponse } from "next/server";
import { assertCronAuthorized } from "@/lib/cronAuth";

function londonHour(): number {
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date()).find((part) => part.type === "hour")?.value;
  return Number(hour);
}

/** Called by GitHub Actions; only the 2am Europe/London invocation performs a sync. */
export async function GET(req: Request) {
  const denied = assertCronAuthorized(req);
  if (denied) return denied;
  if (londonHour() !== 2) return NextResponse.json({ skipped: "outside 2am Europe/London" });

  const syncUrl = new URL("/api/god/integrations/arbor/sync/staff", req.url);
  const response = await fetch(syncUrl, {
    method: "POST",
    headers: {
      Authorization: req.headers.get("authorization") ?? "",
      "x-arbor-scheduled-sync": "1",
    },
    redirect: "manual",
  });
  if (!response.ok) return NextResponse.json({ error: "Arbor staff sync failed" }, { status: 500 });
  return NextResponse.json({ scheduled: true });
}
