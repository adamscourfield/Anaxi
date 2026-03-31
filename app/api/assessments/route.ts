import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { createAssessment } from "@/modules/assessments/import";
import type { GradeFormat } from "@prisma/client";

export async function GET(req: Request) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ASSESSMENTS");
  const { searchParams } = new URL(req.url);
  const pointId = searchParams.get("pointId");
  const subject = searchParams.get("subject");
  const yearGroup = searchParams.get("yearGroup");

  const assessments = await prisma.assessment.findMany({
    where: {
      tenantId: user.tenantId,
      ...(pointId ? { pointId } : {}),
      ...(subject ? { subject } : {}),
      ...(yearGroup ? { yearGroup } : {}),
    },
    include: {
      point: { include: { cycle: true } },
      _count: { select: { results: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ assessments });
}

export async function POST(req: Request) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ASSESSMENTS");
  const body = await req.json();

  const { pointId, subject, yearGroup, title, gradeFormat, maxScore } = body;
  if (!pointId || !subject || !yearGroup || !title || !gradeFormat) {
    return NextResponse.json(
      { error: "pointId, subject, yearGroup, title, and gradeFormat are required" },
      { status: 400 }
    );
  }

  const validFormats: GradeFormat[] = ["GCSE", "A_LEVEL", "PERCENTAGE", "RAW"];
  if (!validFormats.includes(gradeFormat)) {
    return NextResponse.json(
      { error: `Invalid gradeFormat. Must be one of: ${validFormats.join(", ")}` },
      { status: 400 }
    );
  }
  if (gradeFormat === "RAW" && !maxScore) {
    return NextResponse.json(
      { error: "maxScore is required for RAW format assessments" },
      { status: 400 }
    );
  }

  const point = await prisma.assessmentPoint.findFirst({
    where: { id: pointId, tenantId: user.tenantId },
  });
  if (!point) return NextResponse.json({ error: "Result point not found" }, { status: 404 });

  const assessment = await createAssessment({
    tenantId: user.tenantId,
    pointId,
    subject,
    yearGroup,
    title,
    gradeFormat,
    maxScore: gradeFormat === "RAW" ? Number(maxScore) : undefined,
    createdByUserId: user.id,
  });

  return NextResponse.json({ assessment }, { status: 201 });
}
