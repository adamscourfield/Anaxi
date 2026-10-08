import { NextResponse } from "next/server";
import { assertCronAuthorized } from "@/lib/cronAuth";
import { runScheduledArborSync } from "@/lib/integrations/arbor/runScheduledSync";

/**
 * Runs after people sync so every Arbor ID is already linked in Anaxi. GitHub
 * may delay its scheduled calls, but a roster page is idempotent and safe at
 * any time of day.
 */
export async function GET(req: Request) {
  const denied = assertCronAuthorized(req);
  if (denied) return denied;
  const sync = await runScheduledArborSync(req, "/api/god/integrations/arbor/sync/timetable");
  return NextResponse.json({ scheduled: true, connections: sync.results }, { status: sync.failed ? 207 : 200 });
}
