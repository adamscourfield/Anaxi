import { NextRequest, NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { canViewExplorer, canViewAssessmentExplorer } from "@/modules/authz";
import { prisma } from "@/lib/prisma";
import { VALID_WINDOWS } from "@/lib/explorerUtils";
import { writeInsights } from "@/modules/analysis/insightWriter";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUserOrThrow();
    await requireFeature(user.tenantId, "ANALYSIS");

    // Destructive mutation — restrict to ADMIN and SLT only
    if (user.role !== "ADMIN" && user.role !== "SLT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [hodMemberships, coachAssignments] = await Promise.all([
      (prisma as any).departmentMembership.findMany({
        where: { userId: user.id, isHeadOfDepartment: true },
        select: { departmentId: true },
      }),
      (prisma as any).coachAssignment.findMany({
        where: { coachUserId: user.id },
        select: { coacheeUserId: true },
      }),
    ]);

    const hodDepartmentIds = (hodMemberships as { departmentId: string }[]).map((m) => m.departmentId);
    const coacheeUserIds = (coachAssignments as { coacheeUserId: string }[]).map((a) => a.coacheeUserId);
    const viewerContext = { userId: user.id, role: user.role, hodDepartmentIds, coacheeUserIds };

    if (!canViewExplorer(viewerContext) || !canViewAssessmentExplorer(viewerContext)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    // Validate windowDays against the allowed set — prevents full-history DoS queries
    const windowDays: number = VALID_WINDOWS.includes(body.windowDays) ? body.windowDays : 21;

    const result = await writeInsights(user.tenantId, windowDays);

    return NextResponse.json({
      written: result.written,
      deleted: result.deleted,
      computedAt: result.computedAt.toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    if (message === "FORBIDDEN" || message === "FEATURE_DISABLED") {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
