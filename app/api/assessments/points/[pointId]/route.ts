import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireAssessmentWrite, requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import type { ResultStatus } from "@prisma/client";

export async function GET(
  _req: Request,
  { params }: { params: { pointId: string } }
) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ASSESSMENTS");

  const point = await prisma.assessmentPoint.findFirst({
    where: { id: params.pointId, tenantId: user.tenantId },
    include: {
      cycle: {
        select: {
          id: true,
          label: true,
          cohortLabel: true,
          qualificationType: true,
          academicYear: true,
        },
      },
      assessments: {
        select: {
          id: true,
          subject: true,
          yearGroup: true,
          gradeFormat: true,
          uploadStatus: true,
          entryCount: true,
          matchedStudentCount: true,
          expectedStudentCount: true,
          rawFileName: true,
          createdAt: true,
          _count: { select: { results: true } },
        },
        orderBy: { subject: "asc" },
      },
    },
  });

  if (!point) return NextResponse.json({ error: "Result point not found" }, { status: 404 });

  return NextResponse.json({ point });
}

export async function PATCH(
  req: Request,
  { params }: { params: { pointId: string } }
) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ASSESSMENTS");
  requireAssessmentWrite(user);

  const point = await prisma.assessmentPoint.findFirst({
    where: { id: params.pointId, tenantId: user.tenantId },
  });
  if (!point) return NextResponse.json({ error: "Result point not found" }, { status: 404 });

  const body = await req.json();
  const { resultStatus } = body;

  const validStatuses: ResultStatus[] = ["DRAFT", "VALIDATED", "PUBLISHED", "LOCKED"];
  if (resultStatus && !validStatuses.includes(resultStatus)) {
    return NextResponse.json({ error: "Invalid resultStatus" }, { status: 400 });
  }

  const updated = await prisma.assessmentPoint.update({
    where: { id: params.pointId },
    data: {
      ...(resultStatus ? { resultStatus } : {}),
    },
  });

  return NextResponse.json({ point: updated });
}
