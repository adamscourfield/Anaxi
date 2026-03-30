/**
 * POST /api/assessments/points/[pointId]/upload
 *
 * Upload subject results into a result point.
 * Accepts a CSV file and either:
 *   - creates/upserts one Subject Result Set per detected subject column (wide format)
 *   - or imports results into an existing Subject Result Set (single subject mode)
 *
 * Body (multipart/form-data):
 *   file          — CSV file
 *   yearGroup     — e.g. "Year 11"
 *   gradeFormat   — GCSE | A_LEVEL | PERCENTAGE | RAW
 *   subjects      — JSON array of subject column names (wide: which to import)
 *   subject       — single subject name (single-subject mode, creates one result set)
 *   previewOnly   — "true" to return preview without importing
 */

import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { parseAssessmentCsv, detectSubjectColumns } from "@/modules/assessments/csv";
import { importAssessmentResults, createAssessment } from "@/modules/assessments/import";
import type { GradeFormat } from "@prisma/client";

export async function POST(
  req: Request,
  { params }: { params: { pointId: string } }
) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ASSESSMENTS");

  const point = await prisma.assessmentPoint.findFirst({
    where: { id: params.pointId, tenantId: user.tenantId },
    include: { cycle: { select: { id: true, label: true, qualificationType: true } } },
  });
  if (!point) return NextResponse.json({ error: "Result point not found" }, { status: 404 });

  if (point.resultStatus === "LOCKED") {
    return NextResponse.json(
      { error: "This result point is locked and cannot accept new uploads." },
      { status: 403 }
    );
  }

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const yearGroup = String(form.get("yearGroup") || "");
  const gradeFormat = String(form.get("gradeFormat") || "GCSE") as GradeFormat;
  const subjectsRaw = String(form.get("subjects") || "");
  const singleSubject = String(form.get("subject") || "");
  const previewOnly = form.get("previewOnly") === "true";

  if (!file) return NextResponse.json({ error: "file is required" }, { status: 400 });
  if (!yearGroup) return NextResponse.json({ error: "yearGroup is required" }, { status: 400 });

  const validFormats: GradeFormat[] = ["GCSE", "A_LEVEL", "PERCENTAGE", "RAW"];
  if (!validFormats.includes(gradeFormat)) {
    return NextResponse.json({ error: "Invalid gradeFormat" }, { status: 400 });
  }

  const csvText = await file.text();
  const allDetected = detectSubjectColumns(csvText);

  // Determine which subjects to import
  let subjectFilter: string[] | undefined;
  if (singleSubject) {
    subjectFilter = [singleSubject];
  } else if (subjectsRaw) {
    try {
      subjectFilter = JSON.parse(subjectsRaw) as string[];
    } catch {
      subjectFilter = subjectsRaw.split(",").map((s) => s.trim()).filter(Boolean);
    }
  } else {
    subjectFilter = allDetected.length > 0 ? allDetected : undefined;
  }

  const parseResult = parseAssessmentCsv(csvText, {
    gradeFormat,
    subjectFilter,
  });

  if (previewOnly) {
    const subjectCounts = new Map<string, number>();
    for (const r of parseResult.records) {
      subjectCounts.set(r.subject, (subjectCounts.get(r.subject) ?? 0) + 1);
    }
    return NextResponse.json({
      detectedSubjects: allDetected,
      selectedSubjects: subjectFilter ?? allDetected,
      preview: parseResult.records.slice(0, 30),
      errors: parseResult.errors.slice(0, 50),
      totalRecords: parseResult.records.length,
      totalErrors: parseResult.errors.length,
      subjectCounts: Object.fromEntries(subjectCounts),
    });
  }

  // Group records by subject and import
  const recordsBySubject = new Map<string, typeof parseResult.records>();
  for (const rec of parseResult.records) {
    if (!recordsBySubject.has(rec.subject)) recordsBySubject.set(rec.subject, []);
    recordsBySubject.get(rec.subject)!.push(rec);
  }

  if (recordsBySubject.size === 0) {
    return NextResponse.json(
      { error: "No grade records found. Check the file format and grade format selection." },
      { status: 400 }
    );
  }

  const results: Array<{
    subject: string;
    assessmentId: string;
    rowsProcessed: number;
    rowsFailed: number;
  }> = [];

  for (const [subject, records] of recordsBySubject) {
    let assessment = await prisma.assessment.findFirst({
      where: { tenantId: user.tenantId, pointId: params.pointId, subject, yearGroup },
    });

    if (!assessment) {
      assessment = await createAssessment({
        tenantId: user.tenantId,
        pointId: params.pointId,
        subject,
        yearGroup,
        title: `${subject} — ${yearGroup} (${point.label})`,
        gradeFormat,
        createdByUserId: user.id,
      });
    }

    const summary = await importAssessmentResults(
      records,
      [],
      {
        tenantId: user.tenantId,
        assessmentId: assessment.id,
        gradeFormat,
        uploadedByUserId: user.id,
        fileName: file.name,
      }
    );

    // Update assessment counts
    await prisma.assessment.update({
      where: { id: assessment.id },
      data: {
        entryCount: summary.rowsProcessed,
        matchedStudentCount: summary.rowsProcessed,
        rawFileName: file.name,
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
      parseErrors: parseResult.errors.length,
    },
    { status: 201 }
  );
}
