import { NextResponse } from "next/server";
import { assertCronAuthorized } from "@/lib/cronAuth";

/** @deprecated Use POST /api/cron/import-pending-count with x-cron-secret instead. */
export async function POST(req: Request) {
  const denied = assertCronAuthorized(req);
  if (denied) return denied;

  const secret = req.headers.get("x-cron-secret") ?? "";
  const url = new URL(req.url);
  const target = new URL("/api/cron/import-pending-count", url.origin);
  const res = await fetch(target, {
    method: "POST",
    headers: { "x-cron-secret": secret },
  });
  const body = await res.json();
  return NextResponse.json(body, { status: res.status });
}
