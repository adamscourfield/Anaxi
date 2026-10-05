import { NextResponse } from "next/server";
import { assertCronAuthorized } from "@/lib/cronAuth";
import { runScheduledArborSync } from "@/lib/integrations/arbor/runScheduledSync";
export async function GET(req: Request) {
  const denied = assertCronAuthorized(req); if (denied) return denied;
  // A protected GitHub workflow can request a photo-only catch-up outside 2am.
  // This is intentionally unavailable to ordinary browser requests.
  const force = new URL(req.url).searchParams.get("force") === "1";
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date()).find((part) => part.type === "hour")?.value);
  if (hour !== 2 && !force) return NextResponse.json({ skipped: "outside 2am Europe/London" });
  const sync = await runScheduledArborSync(req, "/api/god/integrations/arbor/sync/photos?scheduled=1");
  return NextResponse.json({ scheduled: true, connections: sync.results }, { status: sync.failed ? 207 : 200 });
}
