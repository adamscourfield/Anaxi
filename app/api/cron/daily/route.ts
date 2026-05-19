import { NextResponse } from "next/server";

/** @deprecated Use POST /api/cron/import-pending-count with x-cron-secret instead. */
export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const target = new URL("/api/cron/import-pending-count", url.origin);
  const res = await fetch(target, {
    method: "POST",
    headers: { "x-cron-secret": secret ?? "" },
  });
  const body = await res.json();
  return NextResponse.json(body, { status: res.status });
}
