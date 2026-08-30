import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature, requireAssessmentWrite } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { withApi } from "@/lib/apiRoute";
import { isSubjectStage, type SubjectStage } from "@/lib/subjectStages";

/**
 * Canonical subject names for this tenant, so attainment templates and grade
 * entry reuse the exact same spelling/casing every cycle instead of drifting
 * ("Maths" vs "Math") between separately-typed uploads.
 *
 * Primary source is the tenant's Subject table (active rows, optionally
 * filtered to those tagged for the given stage or tagged for no stage at
 * all -- i.e. "applies everywhere"). Subject names already used on past
 * Assessments but never added to the Subject table are folded in
 * unfiltered, so nothing a tenant already relied on silently disappears.
 */
export const GET = withApi(async function GET(req: Request) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ASSESSMENTS");

  const { searchParams } = new URL(req.url);
  const stageParam = searchParams.get("stage");
  const stage: SubjectStage | null = stageParam && isSubjectStage(stageParam) ? stageParam : null;

  const [subjectRows, assessmentSubjects] = await Promise.all([
    prisma.subject.findMany({
      where: { tenantId: user.tenantId, active: true },
      select: { name: true, stages: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.assessment.findMany({
      where: { tenantId: user.tenantId },
      select: { subject: true },
      distinct: ["subject"],
    }),
  ]);

  const canonicalNames = new Set(subjectRows.map((r) => r.name.trim()));
  const names: string[] = [];

  for (const row of subjectRows) {
    if (stage && row.stages.length > 0 && !row.stages.includes(stage)) continue;
    names.push(row.name.trim());
  }
  // Legacy names used on past assessments that were never registered as a
  // canonical Subject -- always included, since we don't know their stage.
  for (const row of assessmentSubjects) {
    const name = row.subject.trim();
    if (name && !canonicalNames.has(name)) names.push(name);
  }

  return NextResponse.json({ subjects: names.sort((a, b) => a.localeCompare(b)) });
});

/** Create a new canonical subject on the fly (e.g. "add new" from a picker). */
export const POST = withApi(async function POST(req: Request) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ASSESSMENTS");
  requireAssessmentWrite(user);

  const body = await req.json();
  const name = String(body?.name || "").trim();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const stageRaw = String(body?.stage || "");
  const stages = isSubjectStage(stageRaw) ? [stageRaw] : [];

  const subject = await prisma.subject.upsert({
    where: { tenantId_name: { tenantId: user.tenantId, name } },
    update: {},
    create: { tenantId: user.tenantId, name, stages },
  });

  return NextResponse.json({ subject }, { status: 201 });
});
