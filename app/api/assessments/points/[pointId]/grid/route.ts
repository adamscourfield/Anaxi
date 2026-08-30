/**
 * POST /api/assessments/points/[pointId]/grid
 *
 * Save grades entered directly in the in-app grid (paste-from-spreadsheet
 * grade entry), as an alternative to uploading a CSV. Reuses the exact same
 * find-or-create-Assessment + importAssessmentResults pipeline as the CSV
 * upload route, just fed from JSON grid rows instead of a parsed file.
 *
 * Body (JSON):
 *   yearGroup   — e.g. "Year 11"
 *   gradeFormat — GCSE | A_LEVEL | PERCENTAGE | RAW
 *   subjects    — string[] of subject column names, in column order
 *   entries     — [{ upn, studentName, values: { [subject]: rawValue } }]
 */

import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireAssessmentWrite, requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { validateGrade, detectNonGradeStatus } from "@/modules/assessments/gradeNormalizer";
import { importAssessmentResults, createAssessment } from "@/modules/assessments/import";
import type { AssessmentCsvRecord } from "@/modules/assessments/csv";
import type { GradeFormat } from "@prisma/client";
import { withApi } from "@/lib/apiRoute";

type GridEntry = { upn: string; studentName: string; values: Record<string, string> };

export const POST = withApi(async function POST(
  req: Request,
  { params }: { params: Promise<{ pointId: string }> }
) {
  const resolvedParams = await params;
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ASSESSMENTS");
  requireAssessmentWrite(user);

  const point = await prisma.assessmentPoint.findFirst({
    where: { id: resolvedParams.pointId, tenantId: user.tenantId },
  });
  if (!point) return NextResponse.json({ error: "Result point not found" }, { status: 404 });
  if (point.resultStatus === "LOCKED") {
    return NextResponse.json(
      { error: "This result point is locked and cannot accept new entries." },
      { status: 403 }
    );
  }

  const body = await req.json();
  const yearGroup = String(body?.yearGroup || "").trim();
  const gradeFormat = String(body?.gradeFormat || "GCSE") as GradeFormat;
  const subjects = Array.isArray(body?.subjects) ? (body.subjects as string[]) : [];
  const entries = Array.isArray(body?.entries) ? (body.entries as GridEntry[]) : [];

  if (!yearGroup) return NextResponse.json({ error: "yearGroup is required" }, { status: 400 });
  const validFormats: GradeFormat[] = ["GCSE", "A_LEVEL", "PERCENTAGE", "RAW"];
  if (!validFormats.includes(gradeFormat)) {
    return NextResponse.json({ error: "Invalid gradeFormat" }, { status: 400 });
  }
  if (subjects.length === 0) return NextResponse.json({ error: "At least one subject is required" }, { status: 400 });

  const recordsBySubject = new Map<string, AssessmentCsvRecord[]>();
  const parseErrors: Array<{ rowNumber: number; field: string; message: string }> = [];

  entries.forEach((entry, idx) => {
    for (const subject of subjects) {
      const rawValue = String(entry.values?.[subject] ?? "").trim();
      if (!rawValue) continue; // blank cell = subject not taken

      const nonGrade = detectNonGradeStatus(rawValue);
      if (!nonGrade) {
        const validationError = validateGrade(rawValue, gradeFormat, undefined);
        if (validationError) {
          parseErrors.push({ rowNumber: idx + 1, field: subject, message: `${entry.studentName}: ${validationError}` });
          continue;
        }
      }

      if (!recordsBySubject.has(subject)) recordsBySubject.set(subject, []);
      recordsBySubject.get(subject)!.push({
        upn: entry.upn,
        studentName: entry.studentName,
        subject,
        rawValue,
      });
    }
  });

  if (recordsBySubject.size === 0) {
    return NextResponse.json(
      { error: "No grades entered. Fill in at least one cell before saving." },
      { status: 400 }
    );
  }

  const results: Array<{ subject: string; assessmentId: string; rowsProcessed: number; rowsFailed: number }> = [];

  for (const [subject, records] of recordsBySubject) {
    let assessment = await prisma.assessment.findFirst({
      where: { tenantId: user.tenantId, pointId: resolvedParams.pointId, subject, yearGroup },
    });

    if (!assessment) {
      assessment = await createAssessment({
        tenantId: user.tenantId,
        pointId: resolvedParams.pointId,
        subject,
        yearGroup,
        title: `${subject} — ${yearGroup} (${point.label})`,
        gradeFormat,
        createdByUserId: user.id,
      });
    }

    const summary = await importAssessmentResults(records, [], {
      tenantId: user.tenantId,
      assessmentId: assessment.id,
      gradeFormat,
      uploadedByUserId: user.id,
      fileName: "grid-entry",
    });

    const resultCount = await prisma.assessmentResult.count({
      where: { assessmentId: assessment.id, tenantId: user.tenantId },
    });

    await prisma.assessment.update({
      where: { id: assessment.id },
      data: {
        entryCount: resultCount,
        matchedStudentCount: resultCount,
        uploadStatus: summary.rowsFailed === 0 ? "VALIDATED" : "PARTIAL",
        updatedAt: new Date(),
      },
    });

    results.push({
      subject,
      assessmentId: assessment.id,
      rowsProcessed: summary.rowsProcessed,
      rowsFailed: summary.rowsFailed,
    });
  }

  const totalProcessed = results.reduce((s, r) => s + r.rowsProcessed, 0);
  const totalFailed = results.reduce((s, r) => s + r.rowsFailed, 0);

  return NextResponse.json(
    {
      success: true,
      subjectsImported: results.length,
      totalProcessed,
      totalFailed,
      results,
      parseErrors: parseErrors.length,
      parseErrorDetails: parseErrors.slice(0, 50),
    },
    { status: 201 }
  );
});
