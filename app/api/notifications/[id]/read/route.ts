import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { markNotificationRead } from "@/lib/inAppNotifications";
import { withApi } from "@/lib/apiRoute";

export const POST = withApi(async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const user = await getSessionUserOrThrow();
  const result = await markNotificationRead(user.id, resolvedParams.id);
  if (result.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
});
