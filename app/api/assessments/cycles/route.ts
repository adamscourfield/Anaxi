import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import type { QualificationType } from "@prisma/client";

export async function GET() {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ASSESSMENTS");

  const cycles = await prisma.assessmentCycle.findMany({
    where: { tenantId: user.tenantId },
    include: {
      points: {
        orderBy: { ordinal: "asc" },
        include: {
          _count: { select: { assessments: true } },
          assessments: {
            select: {
              entryCount: true,
              matchedStudentCount: true,
              uploadStatus: true,
            },
          },
        },
      },
    },
    orderBy: [{ isActive: "desc" }, { startDate: "desc" }],
  });

  return NextResponse.json({ cycles });
}

export async function POST(req: Request) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ASSESSMENTS");
  const body = await req.json();

  const { label, cohortLabel, qualificationType, academicYear, startDate, endDate } = body;

  if (!label || !startDate || !endDate) {
    return NextResponse.json(
      { error: "label, startDate, and endDate are required" },
      { status: 400 }
    );
  }

  const validTypes: QualificationType[] = ["GCSE", "A_LEVEL", "VOCATIONAL", "OTHER"];
  const resolvedType: QualificationType = validTypes.includes(qualificationType)
    ? qualificationType
    : "OTHER";

  const cycle = await prisma.assessmentCycle.create({
    data: {
      tenantId: user.tenantId,
      label,
      cohortLabel: cohortLabel || "",
      qualificationType: resolvedType,
      academicYear: academicYear || "",
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      isActive: true,
      status: "active",
    },
  });

  return NextResponse.json({ cycle }, { status: 201 });
}
