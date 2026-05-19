import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import {
  countUnreadNotifications,
  listUnreadNotifications,
  markAllNotificationsRead,
} from "@/lib/inAppNotifications";
import { withApi } from "@/lib/apiRoute";

export const GET = withApi(async function GET() {
  const user = await getSessionUserOrThrow();
  const [items, unreadCount] = await Promise.all([
    listUnreadNotifications(user.id, 30),
    countUnreadNotifications(user.id),
  ]);
  return NextResponse.json({ items, unreadCount });
});

export const POST = withApi(async function POST(req: Request) {
  const user = await getSessionUserOrThrow();
  const body = await req.json().catch(() => ({}));
  if (body?.action === "mark_all_read") {
    await markAllNotificationsRead(user.id);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
});
