import { NextResponse } from "next/server";
import { assertCronAuthorized } from "@/lib/cronAuth";
import { runScheduledArborSync } from "@/lib/integrations/arbor/runScheduledSync";

/**
 * GitHub can delay scheduled workflow runs. The underlying job reads the first
 * register of each day, so it remains safe and useful whenever this fires.
 */
export async function GET(req: Request) {
  const denied = assertCronAuthorized(req);
  if (denied) return denied;
  const sync = await runScheduledArborSync(req, "/api/god/integrations/arbor/sync/morning-attendance");
  return NextResponse.json({ connections: sync.results }, { status: sync.failed ? 207 : 200 });
}
