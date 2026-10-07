import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature, requireRole } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { withApi } from "@/lib/apiRoute";

export const PATCH = withApi(async function PATCH(
  req: Request,
  { params }: { params: Promise<{ assessmentId: string }> },
) {
  const { assessmentId } = await params;
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ASSESSMENTS");
  requireRole(user, ["SUPER_ADMIN"]);

  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
  if (!name || name.length > 120) {
    return NextResponse.json({ error: "Enter an assessment name between 1 and 120 characters" }, { status: 400 });
  }

  const assessment = await prisma.assessment.findFirst({ where: { id: assessmentId, tenantId: user.tenantId } });
  if (!assessment) return NextResponse.json({ error: "Assessment not found" }, { status: 404 });

  const updated = await prisma.assessment.update({
    where: { id: assessmentId },
    data: { subject: name, title: name },
  });
  return NextResponse.json({ assessment: updated });
});
