import { NextResponse } from "next/server";
import { assertCronAuthorized } from "@/lib/cronAuth";
import { runScheduledArborSync } from "@/lib/integrations/arbor/runScheduledSync";

/** Continues the versioned historic class-teacher rebuild in safe small pages. */
export async function GET(req: Request) {
  const denied = assertCronAuthorized(req);
  if (denied) return denied;
  const sync = await runScheduledArborSync(req, "/api/god/integrations/arbor/sync/timetable/historic");
  return NextResponse.json({ scheduled: true, connections: sync.results }, { status: sync.failed ? 207 : 200 });
}
