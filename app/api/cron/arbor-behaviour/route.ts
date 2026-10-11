import { NextResponse } from "next/server";
import { assertCronAuthorized } from "@/lib/cronAuth";
import { runScheduledArborSync } from "@/lib/integrations/arbor/runScheduledSync";

export async function GET(req: Request) {
  const denied = assertCronAuthorized(req); if (denied) return denied;
  // GitHub schedules can arrive late; the authenticated, idempotent sync must still run.
  const sync = await runScheduledArborSync(req, "/api/god/integrations/arbor/sync/behaviour");
  return NextResponse.json({ connections: sync.results }, { status: sync.failed ? 207 : 200 });
}
