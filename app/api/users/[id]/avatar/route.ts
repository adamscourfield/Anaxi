import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withApi } from "@/lib/apiRoute";

export const GET = withApi(async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessionUser = await getSessionUserOrThrow();
  const { id } = await params;

  const user = await (prisma as any).user.findFirst({
    where: { id, tenantId: sessionUser.tenantId },
    select: { avatarImage: true, avatarMimeType: true },
  });

  if (!user?.avatarImage || !user.avatarMimeType) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(user.avatarImage, {
    headers: {
      "Content-Type": user.avatarMimeType,
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
});
