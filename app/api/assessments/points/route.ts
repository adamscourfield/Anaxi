import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireAssessmentWrite, requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import type { PointType, ResultStatus } from "@prisma/client";

export async function POST(req: Request) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ASSESSMENTS");
  requireAssessmentWrite(user);
  const body = await req.json();

  const {
    cycleId,
    label,
    shortLabel,
    ordinal,
    pointType,
    resultStatus,
    sourceType,
    isFinalPoint,
    dateTaken,
    assessedAt,
  } = body;

  if (!cycleId || !label || ordinal === undefined || !assessedAt) {
    return NextResponse.json(
      { error: "cycleId, label, ordinal, and assessedAt are required" },
      { status: 400 }
    );
  }

  const validPointTypes: PointType[] = [
    "BASELINE",
    "INTERNAL_ASSESSMENT",
    "INTERNAL_MOCK",
    "TEACHER_PREDICTION",
    "EXTERNAL_FINAL",
    "OTHER",
  ];
  const resolvedType: PointType = validPointTypes.includes(pointType)
    ? pointType
    : "INTERNAL_MOCK";

  const validStatuses: ResultStatus[] = ["DRAFT", "VALIDATED", "PUBLISHED", "LOCKED"];
  const resolvedStatus: ResultStatus = validStatuses.includes(resultStatus)
    ? resultStatus
    : "DRAFT";

  const cycle = await prisma.assessmentCycle.findFirst({
    where: { id: cycleId, tenantId: user.tenantId },
  });
  if (!cycle) return NextResponse.json({ error: "Cycle not found" }, { status: 404 });

  const point = await prisma.assessmentPoint.create({
    data: {
      tenantId: user.tenantId,
      cycleId,
      label,
      shortLabel: shortLabel || null,
      ordinal: Number(ordinal),
      pointType: resolvedType,
      resultStatus: resolvedStatus,
      sourceType: sourceType || "csv_upload",
      isFinalPoint: isFinalPoint === true || resolvedType === "EXTERNAL_FINAL",
      comparisonEligible: true,
      dateTaken: dateTaken ? new Date(dateTaken) : null,
      assessedAt: new Date(assessedAt),
    },
  });

  return NextResponse.json({ point }, { status: 201 });
}
