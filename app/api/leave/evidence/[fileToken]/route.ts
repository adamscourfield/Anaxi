import { NextResponse } from "next/server";
import path from "path";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { canManageLoa } from "@/lib/loa";
import { prisma } from "@/lib/prisma";
import { withApi } from "@/lib/apiRoute";
import { medicalEvidencePublicPath } from "@/lib/leaveMedicalUpload";

export const GET = withApi(async function GET(
  _req: Request,
  { params }: { params: Promise<{ fileToken: string }> },
) {
  try {
    const resolvedParams = await params;
    const user = await getSessionUserOrThrow();
    await requireFeature(user.tenantId, "LEAVE");

    const fileToken = path.basename(resolvedParams.fileToken);
    // Tokens are 32 hex characters. Match exactly, never by substring.
    if (!/^[a-f0-9]{32}$/.test(fileToken)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const loa = await prisma.lOARequest.findFirst({
      where: {
        tenantId: user.tenantId,
        medicalEvidenceUrl: medicalEvidencePublicPath(fileToken),
      },
      select: { requesterId: true, medicalEvidenceData: true, medicalEvidenceMimeType: true },
    });
    if (!loa || !loa.medicalEvidenceData) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const isOwner = loa.requesterId === user.id;
    const isManager = await canManageLoa(user, loa.requesterId);
    if (!isOwner && !isManager) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return new NextResponse(new Uint8Array(loa.medicalEvidenceData), {
      headers: {
        "Content-Type": loa.medicalEvidenceMimeType ?? "application/octet-stream",
        "Cache-Control": "private, no-store",
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
});
