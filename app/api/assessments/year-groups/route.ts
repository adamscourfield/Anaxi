import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { withApi } from "@/lib/apiRoute";

/**
 * The tenant's real year groups (distinct values already in use on active
 * students), so grade-entry pickers offer a closed list instead of free
 * text that could silently target the wrong cohort.
 */
export const GET = withApi(async function GET() {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ASSESSMENTS");

  const rows = await prisma.student.findMany({
    where: { tenantId: user.tenantId, status: "ACTIVE" },
    select: { yearGroup: true },
    distinct: ["yearGroup"],
  });

  const yearGroups = rows
    .map((r) => r.yearGroup)
    .filter((yg): yg is string => Boolean(yg && yg.trim()))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));

  return NextResponse.json({ yearGroups });
});
