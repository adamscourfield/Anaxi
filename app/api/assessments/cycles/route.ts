import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { createAssessmentCycle } from "@/modules/assessments/import";

export async function GET() {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ASSESSMENTS");

  const cycles = await prisma.assessmentCycle.findMany({
    where: { tenantId: user.tenantId },
    include: {
      points: {
        orderBy: { ordinal: "asc" },
        include: { _count: { select: { assessments: true } } },
      },
    },
    orderBy: { startDate: "desc" },
  });

  return NextResponse.json({ cycles });
}

export async function POST(req: Request) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ASSESSMENTS");
  const body = await req.json();

  const { label, startDate, endDate } = body;
  if (!label || !startDate || !endDate) {
    return NextResponse.json({ error: "label, startDate, and endDate are required" }, { status: 400 });
  }

  const cycle = await createAssessmentCycle({
    tenantId: user.tenantId,
    label,
    startDate: new Date(startDate),
    endDate: new Date(endDate),
  });

  return NextResponse.json({ cycle }, { status: 201 });
}
