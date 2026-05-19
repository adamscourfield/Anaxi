import { readFile } from "fs/promises";
import { NextResponse } from "next/server";
import path from "path";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { canManageLoa } from "@/lib/loa";
import { medicalEvidenceDiskPath } from "@/lib/leaveMedicalUpload";
import { prisma } from "@/lib/prisma";
import { withApi } from "@/lib/apiRoute";

const MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

export const GET = withApi(async function GET(
  _req: Request,
  { params }: { params: { fileToken: string } },
) {
  try {
    const user = await getSessionUserOrThrow();
    await requireFeature(user.tenantId, "LEAVE");

    const fileToken = path.basename(params.fileToken);
    const diskPath = medicalEvidenceDiskPath(user.tenantId, fileToken);
    if (!diskPath) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const loa = await prisma.lOARequest.findFirst({
      where: {
        tenantId: user.tenantId,
        medicalEvidenceUrl: { contains: fileToken },
      },
      select: { requesterId: true },
    });
    if (!loa) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const isOwner = loa.requesterId === user.id;
    const isManager = await canManageLoa(user, loa.requesterId);
    if (!isOwner && !isManager) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const ext = path.extname(fileToken).toLowerCase();
    const body = await readFile(diskPath);
    return new NextResponse(body, {
      headers: {
        "Content-Type": MIME[ext] ?? "application/octet-stream",
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
});
