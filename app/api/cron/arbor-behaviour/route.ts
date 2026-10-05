import { NextResponse } from "next/server";
import { assertCronAuthorized } from "@/lib/cronAuth";
import { runScheduledArborSync } from "@/lib/integrations/arbor/runScheduledSync";

export async function GET(req: Request) {
  const denied = assertCronAuthorized(req); if (denied) return denied;
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date()).find((part) => part.type === "hour")?.value);
  if (hour !== 2) return NextResponse.json({ skipped: "outside 2am Europe/London" });
  const sync = await runScheduledArborSync(req, "/api/god/integrations/arbor/sync/behaviour");
  return NextResponse.json({ connections: sync.results }, { status: sync.failed ? 207 : 200 });
}
