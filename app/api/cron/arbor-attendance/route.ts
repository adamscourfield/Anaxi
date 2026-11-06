import { NextResponse } from "next/server";
import { assertCronAuthorized } from "@/lib/cronAuth";
import { runScheduledArborSync } from "@/lib/integrations/arbor/runScheduledSync";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** Vercel runs the daily import directly; the independent fallback also catches up history. */
export async function GET(req: Request) {
  const denied = assertCronAuthorized(req);
  if (denied) return denied;
  const sync = await runScheduledArborSync(req, "/api/god/integrations/arbor/sync/attendance");
  return NextResponse.json({ connections: sync.results }, { status: sync.failed ? 502 : 200 });
}
