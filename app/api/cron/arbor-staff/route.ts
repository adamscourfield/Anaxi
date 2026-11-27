import { NextResponse } from "next/server";
import { assertCronAuthorized } from "@/lib/cronAuth";
import { runScheduledArborSync } from "@/lib/integrations/arbor/runScheduledSync";

export const maxDuration = 300;

export async function GET(req: Request) {
  const denied = assertCronAuthorized(req);
  if (denied) return denied;

  const sync = await runScheduledArborSync(req, "/api/god/integrations/arbor/sync/staff", process.env.NEXTAUTH_URL ?? req.url);
  return NextResponse.json({ scheduled: true, connections: sync.results }, { status: sync.failed ? 207 : 200 });
}
