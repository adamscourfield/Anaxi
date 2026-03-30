import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: { cycleId: string } }
) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ASSESSMENTS");

  const cycle = await prisma.assessmentCycle.findFirst({
    where: { id: params.cycleId, tenantId: user.tenantId },
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
}

export async function PATCH(
  req: Request,
  { params }: { params: { cycleId: string } }
) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ASSESSMENTS");

  const cycle = await prisma.assessmentCycle.findFirst({
    where: { id: params.cycleId, tenantId: user.tenantId },
  });
  if (!cycle) return NextResponse.json({ error: "Cycle not found" }, { status: 404 });

  const body = await req.json();
  const { status, isActive } = body;

  const updated = await prisma.assessmentCycle.update({
    where: { id: params.cycleId },
    data: {
      ...(status !== undefined ? { status } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    },
  });

  return NextResponse.json({ cycle: updated });
}
