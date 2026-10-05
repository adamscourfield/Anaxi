import { NextResponse } from "next/server";
import { assertCronAuthorized } from "@/lib/cronAuth";
import { runScheduledArborSync } from "@/lib/integrations/arbor/runScheduledSync";

function londonHour(): number {
  const hour = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date()).find((part) => part.type === "hour")?.value;
  return Number(hour);
}

/** Runs after people sync so every Arbor ID is already linked in Anaxi. */
export async function GET(req: Request) {
  const denied = assertCronAuthorized(req);
  if (denied) return denied;
  if (londonHour() !== 2) return NextResponse.json({ skipped: "outside 2am Europe/London" });
  const sync = await runScheduledArborSync(req, "/api/god/integrations/arbor/sync/timetable");
  return NextResponse.json({ scheduled: true, connections: sync.results }, { status: sync.failed ? 207 : 200 });
}
