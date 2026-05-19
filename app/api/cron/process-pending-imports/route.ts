import { NextResponse } from "next/server";
import { assertCronAuthorized } from "@/lib/cronAuth";
import { processPendingImportJobs } from "@/modules/import/processPendingJobs";

/** Cron: process queued CSV import jobs (avoids HTTP timeouts on large files). */
export async function POST(req: Request) {
  const denied = assertCronAuthorized(req);
  if (denied) return denied;

  const processed = await processPendingImportJobs(10);
  return NextResponse.json({ processed, checkedAt: new Date().toISOString() });
}
