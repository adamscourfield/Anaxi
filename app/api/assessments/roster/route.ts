import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature, requireAssessmentWrite } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { withApi } from "@/lib/apiRoute";
import { normalizeYearGroup } from "@/lib/yearGroup";

/** Full (unpaginated) student roster for a year group, for the grade-entry grid. */
export const GET = withApi(async function GET(req: Request) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ASSESSMENTS");
  requireAssessmentWrite(user);

  const { searchParams } = new URL(req.url);
  const yearGroup = normalizeYearGroup(String(searchParams.get("yearGroup") || "")) ?? "";
  if (!yearGroup) return NextResponse.json({ error: "yearGroup is required" }, { status: 400 });

  const students = await prisma.student.findMany({
    where: { tenantId: user.tenantId, status: "ACTIVE", yearGroup },
    select: { id: true, upn: true, fullName: true },
    orderBy: { fullName: "asc" },
  });

  return NextResponse.json({ students });
});
