import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { withApi } from "@/lib/apiRoute";

/**
 * Canonical subject names for this tenant, so attainment templates reuse the
 * exact same spelling/casing every cycle instead of drifting ("Maths" vs
 * "Math") between separately-typed uploads. Union of the tenant's registered
 * Subject list and subject names already used on past assessments.
 */
export const GET = withApi(async function GET() {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ASSESSMENTS");

  const [subjectRows, assessmentSubjects] = await Promise.all([
    prisma.subject.findMany({
      where: { tenantId: user.tenantId },
      select: { name: true },
    }),
    prisma.assessment.findMany({
      where: { tenantId: user.tenantId },
      select: { subject: true },
      distinct: ["subject"],
    }),
  ]);

  const names = new Set<string>();
  for (const row of subjectRows) names.add(row.name.trim());
  for (const row of assessmentSubjects) names.add(row.subject.trim());

  const subjects = Array.from(names).sort((a, b) => a.localeCompare(b));

  return NextResponse.json({ subjects });
});
