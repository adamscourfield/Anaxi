import { NextResponse } from "next/server";
import { assertCronAuthorized } from "@/lib/cronAuth";
import { runScheduledArborSync } from "@/lib/integrations/arbor/runScheduledSync";

export async function GET(req: Request) {
  const denied = assertCronAuthorized(req); if (denied) return denied;
  const sync = await runScheduledArborSync(req, "/api/god/integrations/arbor/staff/provisioning");
  return NextResponse.json({ connections: sync.results }, { status: sync.failed ? 207 : 200 });
}
