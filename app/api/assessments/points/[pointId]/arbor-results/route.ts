import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { withApi } from "@/lib/apiRoute";
import { requireAssessmentWrite, requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { computeAndStoreRanks } from "@/modules/assessments/import";
import { detectNonGradeStatus, normalizeGrade, validateGrade } from "@/modules/assessments/gradeNormalizer";

async function pointForTenant(pointId: string, tenantId: string) {
  return prisma.assessmentPoint.findFirst({ where: { id: pointId, tenantId } });
}

export const GET = withApi(async function GET(_req: Request, { params }: { params: Promise<{ pointId: string }> }) {
  const { pointId } = await params;
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ASSESSMENTS");

  const point = await pointForTenant(pointId, user.tenantId);
  if (!point) return NextResponse.json({ error: "Result point not found" }, { status: 404 });
  const assessments = await prisma.assessment.findMany({
    where: { pointId, tenantId: user.tenantId, dataSource: "ARBOR" },
    orderBy: { subject: "asc" },
    include: { results: { include: { student: { select: { id: true, fullName: true, yearGroup: true } } }, orderBy: { student: { fullName: "asc" } } } },
  });
  const students = await prisma.student.findMany({
    where: { tenantId: user.tenantId, status: "ACTIVE" },
    select: { id: true, fullName: true, yearGroup: true },
    orderBy: { fullName: "asc" },
  });
  return NextResponse.json({ point: { id: point.id, label: point.label, resultStatus: point.resultStatus }, assessments, students });
});

export const PATCH = withApi(async function PATCH(req: Request, { params }: { params: Promise<{ pointId: string }> }) {
  const { pointId } = await params;
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ASSESSMENTS");
  requireAssessmentWrite(user);
  const point = await pointForTenant(pointId, user.tenantId);
  if (!point) return NextResponse.json({ error: "Result point not found" }, { status: 404 });
  if (point.resultStatus === "LOCKED") return NextResponse.json({ error: "This result point is locked." }, { status: 403 });

  const body = await req.json();
  const resultId = typeof body.resultId === "string" ? body.resultId : "";
  const rawValue = typeof body.rawValue === "string" ? body.rawValue.trim() : "";
  if (!resultId || !rawValue) return NextResponse.json({ error: "A result and corrected grade are required." }, { status: 400 });
  const result = await prisma.assessmentResult.findFirst({
    where: { id: resultId, tenantId: user.tenantId, assessment: { pointId, dataSource: "ARBOR" } },
    include: { assessment: { select: { id: true, gradeFormat: true, maxScore: true } } },
  });
  if (!result) return NextResponse.json({ error: "Arbor result not found" }, { status: 404 });
  const status = detectNonGradeStatus(rawValue) ?? "PRESENT";
  const validationError = status === "PRESENT" ? validateGrade(rawValue, result.assessment.gradeFormat, result.assessment.maxScore) : null;
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
  const normalizedScore = status === "PRESENT" ? normalizeGrade(rawValue, result.assessment.gradeFormat, result.assessment.maxScore) : null;
  const updated = await prisma.assessmentResult.update({
    where: { id: result.id },
    data: { rawValue, normalizedScore, normalisedGrade: rawValue, status, isValid: validationError === null, isManuallyOverridden: true, manualOverrideAt: new Date(), manualOverrideByUserId: user.id },
  });
  await computeAndStoreRanks(user.tenantId, result.assessment.id);
  await prisma.auditLog.create({ data: { tenantId: user.tenantId, actorUserId: user.id, action: "assessment.arbor_result_overridden", targetType: "AssessmentResult", targetId: result.id, beforeJson: { rawValue: result.rawValue, arborRawValue: result.arborRawValue }, afterJson: { rawValue, arborRawValue: result.arborRawValue } } });
  return NextResponse.json({ result: updated });
});

export const POST = withApi(async function POST(req: Request, { params }: { params: Promise<{ pointId: string }> }) {
  const { pointId } = await params;
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ASSESSMENTS");
  requireAssessmentWrite(user);
  const point = await pointForTenant(pointId, user.tenantId);
  if (!point) return NextResponse.json({ error: "Result point not found" }, { status: 404 });
  if (point.resultStatus === "LOCKED") return NextResponse.json({ error: "This result point is locked." }, { status: 403 });

  const body = await req.json();
  const assessmentId = typeof body.assessmentId === "string" ? body.assessmentId : "";
  const studentId = typeof body.studentId === "string" ? body.studentId : "";
  const rawValue = typeof body.rawValue === "string" ? body.rawValue.trim() : "";
  if (!assessmentId || !studentId || !rawValue) return NextResponse.json({ error: "Subject, student, and grade are required." }, { status: 400 });
  const [assessment, student] = await Promise.all([
    prisma.assessment.findFirst({ where: { id: assessmentId, pointId, tenantId: user.tenantId, dataSource: "ARBOR" } }),
    prisma.student.findFirst({ where: { id: studentId, tenantId: user.tenantId } }),
  ]);
  if (!assessment || !student) return NextResponse.json({ error: "Choose an Arbor subject and a student in this school." }, { status: 404 });
  const status = detectNonGradeStatus(rawValue) ?? "PRESENT";
  const validationError = status === "PRESENT" ? validateGrade(rawValue, assessment.gradeFormat, assessment.maxScore) : null;
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
  const existing = await prisma.assessmentResult.findUnique({ where: { tenantId_assessmentId_studentId: { tenantId: user.tenantId, assessmentId, studentId } } });
  if (existing) return NextResponse.json({ error: "This student already has a result for the selected subject. Edit that result instead." }, { status: 409 });
  const normalizedScore = status === "PRESENT" ? normalizeGrade(rawValue, assessment.gradeFormat, assessment.maxScore) : null;
  const result = await prisma.assessmentResult.create({
    data: { tenantId: user.tenantId, assessmentId, studentId, rawValue, normalizedScore, normalisedGrade: rawValue, status, isValid: true, dataSource: "ARBOR", isManuallyOverridden: true, manualOverrideAt: new Date(), manualOverrideByUserId: user.id },
  });
  await computeAndStoreRanks(user.tenantId, assessment.id);
  await prisma.auditLog.create({ data: { tenantId: user.tenantId, actorUserId: user.id, action: "assessment.arbor_result_added", targetType: "AssessmentResult", targetId: result.id, afterJson: { assessmentId, studentId, rawValue } } });
  return NextResponse.json({ result }, { status: 201 });
});

export const DELETE = withApi(async function DELETE(req: Request, { params }: { params: Promise<{ pointId: string }> }) {
  const { pointId } = await params;
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ASSESSMENTS");
  requireAssessmentWrite(user);
  const point = await pointForTenant(pointId, user.tenantId);
  if (!point) return NextResponse.json({ error: "Result point not found" }, { status: 404 });
  if (point.resultStatus === "LOCKED") return NextResponse.json({ error: "This result point is locked." }, { status: 403 });
  const { resultId } = await req.json();
  const result = await prisma.assessmentResult.findFirst({ where: { id: resultId, tenantId: user.tenantId, assessment: { pointId, dataSource: "ARBOR" } }, include: { assessment: { select: { id: true } } } });
  if (!result?.isManuallyOverridden) return NextResponse.json({ error: "An Anaxi correction was not found." }, { status: 404 });

  if (result.arborRawValue === null) {
    await prisma.assessmentResult.delete({ where: { id: result.id } });
  } else {
    await prisma.assessmentResult.update({ where: { id: result.id }, data: { rawValue: result.arborRawValue, normalizedScore: result.arborNormalizedScore, normalisedGrade: result.arborNormalisedGrade, isManuallyOverridden: false, manualOverrideAt: null, manualOverrideByUserId: null } });
  }
  await computeAndStoreRanks(user.tenantId, result.assessment.id);
  await prisma.auditLog.create({ data: { tenantId: user.tenantId, actorUserId: user.id, action: "assessment.arbor_override_removed", targetType: "AssessmentResult", targetId: result.id } });
  return NextResponse.json({ success: true });
});
