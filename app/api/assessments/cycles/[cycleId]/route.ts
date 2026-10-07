import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireAssessmentWrite, requireFeature, requireRole } from "@/lib/guards";
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
  const { status, isActive, label } = body;
  if (label !== undefined) {
    requireRole(user, ["SUPER_ADMIN"]);
    if (typeof label !== "string" || !label.trim() || label.trim().length > 120) {
      return NextResponse.json({ error: "Enter a cycle name between 1 and 120 characters" }, { status: 400 });
    }
  }

  try {
    const updated = await prisma.assessmentCycle.update({
      where: { id: resolvedParams.cycleId },
      data: {
        ...(status !== undefined ? { status } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
        ...(label !== undefined ? { label: label.trim().replace(/\s+/g, " ") } : {}),
      },
    });
    return NextResponse.json({ cycle: updated });
  } catch (error: any) {
    if (error?.code === "P2002") return NextResponse.json({ error: "A cycle with that name already exists" }, { status: 409 });
    throw error;
  }
});

export const DELETE = withApi(async function DELETE(
  _req: Request,
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

  // Points, assessments, results and sub-topic scores all cascade from the cycle,
  // so one delete removes the whole tree.
  await prisma.assessmentCycle.delete({ where: { id: resolvedParams.cycleId } });

  return NextResponse.json({ ok: true });
});
