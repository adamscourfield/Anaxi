import { NextResponse } from "next/server";
import { requireEnv } from "@/lib/env";

/** Validates the x-cron-secret header against CRON_SECRET. */
export function assertCronAuthorized(req: Request): NextResponse | null {
  const expected = requireEnv("CRON_SECRET") ?? process.env.CRON_SECRET;
  const secret = req.headers.get("x-cron-secret");
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return null;
}
