import { NextResponse } from "next/server";
import { requireEnv } from "@/lib/env";

/**
 * Validates the request against CRON_SECRET. Accepts either an `x-cron-secret`
 * header (for manual/external callers) or Vercel's native `Authorization:
 * Bearer <CRON_SECRET>` header (sent automatically for Vercel Cron-triggered
 * requests, which are always GET).
 */
export function assertCronAuthorized(req: Request): NextResponse | null {
  const expected = requireEnv("CRON_SECRET") ?? process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  const bearerSecret = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const provided = bearerSecret ?? req.headers.get("x-cron-secret");
  if (!expected || provided !== expected) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return null;
}
