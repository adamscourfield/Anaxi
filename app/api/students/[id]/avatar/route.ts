import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Serves a student's stored photo only to a signed-in member of that school. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUserOrThrow();
  const { id } = await params;
  const student = await prisma.student.findFirst({ where: { id, tenantId: user.tenantId }, select: { avatarImage: true, avatarMimeType: true } });
  if (!student?.avatarImage || !student.avatarMimeType) return new NextResponse(null, { status: 404 });
  return new NextResponse(student.avatarImage, { headers: { "Content-Type": student.avatarMimeType, "Cache-Control": "private, max-age=3600" } });
}
