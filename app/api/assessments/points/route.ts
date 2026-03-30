import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { createAssessmentPoint } from "@/modules/assessments/import";

export async function POST(req: Request) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ASSESSMENTS");
  const body = await req.json();

  const { cycleId, label, ordinal, assessedAt } = body;
  if (!cycleId || !label || ordinal === undefined || !assessedAt) {
    return NextResponse.json(
      { error: "cycleId, label, ordinal, and assessedAt are required" },
      { status: 400 }
    );
  }

  // Verify cycle belongs to tenant
  const cycle = await prisma.assessmentCycle.findFirst({
    where: { id: cycleId, tenantId: user.tenantId },
  });
  if (!cycle) return NextResponse.json({ error: "Cycle not found" }, { status: 404 });

  const point = await createAssessmentPoint({
    tenantId: user.tenantId,
    cycleId,
    label,
    ordinal: Number(ordinal),
    assessedAt: new Date(assessedAt),
  });

  return NextResponse.json({ point }, { status: 201 });
}
