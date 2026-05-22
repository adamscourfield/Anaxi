import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireAssessmentWrite, requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { withApi } from "@/lib/apiRoute";

export const GET = withApi(async function GET(
  _req: Request,
  { params }: { params: Promise<{ cycleId: string }> }
) {
  const resolvedParams = await params;
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ASSESSMENTS");

  const cycle = await prisma.assessmentCycle.findFirst({
    where: { id: resolvedParams.cycleId, tenantId: user.tenantId },
    include: {
      points: {
        orderBy: { ordinal: "asc" },
        include: {
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
            },
          },
        },
      },
    },
  });

  if (!cycle) return NextResponse.json({ error: "Cycle not found" }, { status: 404 });

  return NextResponse.json({ cycle });
});

export const PATCH = withApi(async function PATCH(
  req: Request,
  { params }: { params: Promise<{ cycleId: string }> }
) {
  const resolvedParams = await params;
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ASSESSMENTS");
  requireAssessmentWrite(user);

  const cycle = await prisma.assessmentCycle.findFirst({
    where: { id: resolvedParams.cycleId, tenantId: user.tenantId },
  });
  if (!cycle) return NextResponse.json({ error: "Cycle not found" }, { status: 404 });

  const body = await req.json();
  const { status, isActive } = body;

  const updated = await prisma.assessmentCycle.update({
    where: { id: resolvedParams.cycleId },
    data: {
      ...(status !== undefined ? { status } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    },
  });

  return NextResponse.json({ cycle: updated });
});
