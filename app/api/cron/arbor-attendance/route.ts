import { NextResponse } from "next/server";
import { assertCronAuthorized } from "@/lib/cronAuth";
import { runScheduledArborSync } from "@/lib/integrations/arbor/runScheduledSync";

/** Called repeatedly by GitHub Actions so an initial year-to-date catch-up stays small. */
export async function GET(req: Request) {
  const denied = assertCronAuthorized(req);
  if (denied) return denied;
  const sync = await runScheduledArborSync(req, "/api/god/integrations/arbor/sync/attendance");
  return NextResponse.json({ connections: sync.results }, { status: sync.failed ? 207 : 200 });
}
