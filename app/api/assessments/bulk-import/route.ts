/**
 * POST /api/assessments/bulk-import
 *
 * Handles bulk CSV import for an assessment point.
 * The CSV can contain grades for multiple subjects in one file (wide format).
 * Each subject column becomes a separate Assessment record under the same point.
 *
 * Body (multipart/form-data):
 *   file          — the CSV file
 *   pointId       — the assessment point to import into
 *   yearGroup     — year group (e.g. "Year 11", "Year 13")
 *   gradeFormat   — GCSE | A_LEVEL | PERCENTAGE | RAW
 *   subjects      — JSON array of subject column names to import (all detected if omitted)
 *   previewOnly   — "true" to return preview without importing
 */

import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { parseAssessmentCsv, detectSubjectColumns } from "@/modules/assessments/csv";
import { createAssessment, importAssessmentResults } from "@/modules/assessments/import";
import type { GradeFormat } from "@prisma/client";

export async function POST(req: Request) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ASSESSMENTS");

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const pointId = String(form.get("pointId") || "");
  const yearGroup = String(form.get("yearGroup") || "");
  const gradeFormat = String(form.get("gradeFormat") || "GCSE") as GradeFormat;
  const subjectsRaw = String(form.get("subjects") || "");
  const previewOnly = form.get("previewOnly") === "true";

  if (!file) return NextResponse.json({ error: "file is required" }, { status: 400 });
  if (!pointId) return NextResponse.json({ error: "pointId is required" }, { status: 400 });
  if (!yearGroup) return NextResponse.json({ error: "yearGroup is required" }, { status: 400 });

  const validFormats: GradeFormat[] = ["GCSE", "A_LEVEL", "PERCENTAGE", "RAW"];
  if (!validFormats.includes(gradeFormat)) {
    return NextResponse.json({ error: "Invalid gradeFormat" }, { status: 400 });
  }

  // Verify point belongs to tenant
  const point = await prisma.assessmentPoint.findFirst({
    where: { id: pointId, tenantId: user.tenantId },
    include: { cycle: true },
  });
  if (!point) return NextResponse.json({ error: "Assessment point not found" }, { status: 404 });

  const csvText = await file.text();

  // Detect subject columns from CSV
  const allDetected = detectSubjectColumns(csvText);

  let subjectFilter: string[] | undefined;
  if (subjectsRaw) {
    try {
      subjectFilter = JSON.parse(subjectsRaw) as string[];
    } catch {
      subjectFilter = subjectsRaw.split(",").map((s) => s.trim()).filter(Boolean);
    }
  } else {
    subjectFilter = allDetected; // import all detected subjects
  }

  if (!subjectFilter || subjectFilter.length === 0) {
    return NextResponse.json({
      detectedSubjects: allDetected,
      error: "No subject columns detected in CSV. Check the file format.",
    }, { status: 400 });
  }

  // Parse CSV — one record per student-subject combination
  const parseResult = parseAssessmentCsv(csvText, {
    gradeFormat,
    subjectFilter,
  });

  if (previewOnly) {
    // Return detected subjects + preview records
    const subjectCounts = new Map<string, number>();
    for (const r of parseResult.records) {
      subjectCounts.set(r.subject, (subjectCounts.get(r.subject) ?? 0) + 1);
    }
    return NextResponse.json({
      detectedSubjects: allDetected,
      selectedSubjects: subjectFilter,
      preview: parseResult.records.slice(0, 30),
      errors: parseResult.errors.slice(0, 50),
      totalRecords: parseResult.records.length,
      totalErrors: parseResult.errors.length,
      subjectCounts: Object.fromEntries(subjectCounts),
    });
  }

  // Group records by subject
  const recordsBySubject = new Map<string, typeof parseResult.records>();
  for (const rec of parseResult.records) {
    if (!recordsBySubject.has(rec.subject)) recordsBySubject.set(rec.subject, []);
    recordsBySubject.get(rec.subject)!.push(rec);
  }

  const results: Array<{
    subject: string;
    assessmentId: string;
    rowsProcessed: number;
    rowsFailed: number;
  }> = [];

  // For each subject, upsert the Assessment and import results
  for (const [subject, records] of recordsBySubject) {
    // Find or create Assessment
    let assessment = await prisma.assessment.findFirst({
      where: { tenantId: user.tenantId, pointId, subject, yearGroup },
    });

    if (!assessment) {
      assessment = await createAssessment({
        tenantId: user.tenantId,
        pointId,
        subject,
        yearGroup,
        title: `${subject} — ${yearGroup} (${point.label})`,
        gradeFormat,
        createdByUserId: user.id,
      });
    }

    const summary = await importAssessmentResults(
      records,
      parseResult.errors.filter((e) => {
        // Associate errors with this subject if field matches
        return e.field === subject || e.field === "Name" || e.field === "UPN";
      }),
      {
        tenantId: user.tenantId,
        assessmentId: assessment.id,
        gradeFormat,
        uploadedByUserId: user.id,
        fileName: file.name,
      }
    );

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

/**
 * GET /api/assessments/bulk-import?csvPreview=1&pointId=...
 * Returns detected subject columns for a given CSV (via query params).
 * Accepts a file via form data when method is GET is not feasible;
 * use POST with previewOnly=true instead.
 */
