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
 *   entries     — [{ studentId?, upn, studentName, values: { [subject]: rawValue } }]
 *   mode        — "changes": entries are only the cells that changed, and a blank value
 *                 removes that student's grade. Without it (older clients), a blank cell is
 *                 skipped as "not taken" and nothing is removed.
 */

import { NextResponse } from "next/server";
import { formatYearGroup, normalizeYearGroup } from "@/lib/yearGroup";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireAssessmentWrite, requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { validateGrade, detectNonGradeStatus } from "@/modules/assessments/gradeNormalizer";
import { importAssessmentResults, createAssessment } from "@/modules/assessments/import";
import type { AssessmentCsvRecord } from "@/modules/assessments/csv";
import type { GradeFormat } from "@prisma/client";
import { withApi } from "@/lib/apiRoute";

type GridEntry = { studentId?: string; upn: string; studentName: string; values: Record<string, string> };

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
  const yearGroup = normalizeYearGroup(String(body?.yearGroup || "")) ?? "";
  const gradeFormat = String(body?.gradeFormat || "GCSE") as GradeFormat;
  const subjects = Array.isArray(body?.subjects) ? (body.subjects as string[]) : [];
  const entries = Array.isArray(body?.entries) ? (body.entries as GridEntry[]) : [];
  const changesOnly = body?.mode === "changes";

  if (!yearGroup) return NextResponse.json({ error: "yearGroup is required" }, { status: 400 });
  const validFormats: GradeFormat[] = ["GCSE", "A_LEVEL", "PERCENTAGE", "RAW"];
  if (!validFormats.includes(gradeFormat)) {
    return NextResponse.json({ error: "Invalid gradeFormat" }, { status: 400 });
  }
  if (subjects.length === 0) return NextResponse.json({ error: "At least one subject is required" }, { status: 400 });

  const recordsBySubject = new Map<string, AssessmentCsvRecord[]>();
  const clearedBySubject = new Map<string, string[]>();
  const parseErrors: Array<{ rowNumber: number; field: string; message: string }> = [];

  entries.forEach((entry, idx) => {
    for (const subject of subjects) {
      const rawValue = String(entry.values?.[subject] ?? "").trim();
      if (!rawValue) {
        // A cleared cell removes the grade; on older clients a blank meant "not taken".
        if (changesOnly && entry.studentId) {
          if (!clearedBySubject.has(subject)) clearedBySubject.set(subject, []);
          clearedBySubject.get(subject)!.push(entry.studentId);
        }
        continue;
      }

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
        studentId: entry.studentId || undefined,
        upn: entry.upn,
        studentName: entry.studentName,
        subject,
        rawValue,
      });
    }
  });

  if (parseErrors.length) {
    // Save nothing if any grade is invalid, so a save is never half done.
    return NextResponse.json(
      { error: `${parseErrors.length} grade${parseErrors.length === 1 ? " doesn't" : "s don't"} match the grade format.`, parseErrors: parseErrors.length, parseErrorDetails: parseErrors.slice(0, 50) },
      { status: 400 }
    );
  }
  if (recordsBySubject.size === 0 && clearedBySubject.size === 0) {
    return NextResponse.json(
      { error: "No grades entered. Fill in at least one cell before saving." },
      { status: 400 }
    );
  }

  const results: Array<{ subject: string; assessmentId: string; rowsProcessed: number; rowsFailed: number; rowsCleared: number }> = [];

  for (const subject of new Set([...recordsBySubject.keys(), ...clearedBySubject.keys()])) {
    const records = recordsBySubject.get(subject) ?? [];
    const cleared = clearedBySubject.get(subject) ?? [];
    let assessment = await prisma.assessment.findFirst({
      where: { tenantId: user.tenantId, pointId: resolvedParams.pointId, subject, yearGroup },
    });
    if (!assessment && records.length === 0) continue; // nothing to clear

    if (!assessment) {
      assessment = await createAssessment({
        tenantId: user.tenantId,
        pointId: resolvedParams.pointId,
        subject,
        yearGroup,
        title: `${subject} — ${formatYearGroup(yearGroup)} (${point.label})`,
        gradeFormat,
        createdByUserId: user.id,
      });
    }

    const rowsCleared = cleared.length
      ? (await prisma.assessmentResult.deleteMany({
          where: { tenantId: user.tenantId, assessmentId: assessment.id, studentId: { in: cleared } },
        })).count
      : 0;
    const summary = records.length
      ? await importAssessmentResults(records, [], {
          tenantId: user.tenantId,
          assessmentId: assessment.id,
          gradeFormat,
          uploadedByUserId: user.id,
          fileName: "grid-entry",
        })
      : { rowsProcessed: 0, rowsFailed: 0 };

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
      rowsCleared,
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
      totalCleared: results.reduce((s, r) => s + r.rowsCleared, 0),
      results,
      parseErrors: parseErrors.length,
      parseErrorDetails: parseErrors.slice(0, 50),
    },
    { status: 201 }
  );
});

/** Load the complete cohort and existing grades for the marksheet. */
export const GET = withApi(async function GET(_req: Request, { params }: { params: Promise<{ pointId: string }> }) {
  const { pointId } = await params;
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ASSESSMENTS");
  requireAssessmentWrite(user);
  const point = await prisma.assessmentPoint.findFirst({
    where: { id: pointId, tenantId: user.tenantId },
    include: { cycle: true, assessments: { include: { results: { select: { studentId: true, rawValue: true } } } } },
  });
  if (!point) return NextResponse.json({ error: "Result point not found" }, { status: 404 });
  // An assessment can cover several years ("Y7, Y8, Y9"); match students in any of them.
  const yearGroups = [...new Set(point.assessments.flatMap(a => (normalizeYearGroup(a.yearGroup) ?? "").split(", ").filter(Boolean)))];
  const resultStudentIds = point.assessments.flatMap(a => a.results.map(r => r.studentId));
  const students = await prisma.student.findMany({
    where: { tenantId: user.tenantId, status: "ACTIVE", OR: [{ yearGroup: { in: yearGroups } }, { id: { in: resultStudentIds } }] },
    select: { id: true, fullName: true, upn: true, yearGroup: true }, orderBy: { fullName: "asc" },
  });
  const values: Record<string, Record<string, string>> = {};
  for (const assessment of point.assessments) for (const result of assessment.results) {
    (values[result.studentId] ??= {})[assessment.subject] = result.rawValue;
  }
  return NextResponse.json({ point: { label: point.label, status: point.resultStatus, cycleLabel: point.cycle.label },
    students, values, subjects: [...new Set(point.assessments.map(a => a.subject))].sort(),
    assessments: point.assessments.map(a => ({ subject: a.subject, yearGroup: a.yearGroup, gradeFormat: a.gradeFormat, studentIds: a.results.map(r => r.studentId) })) });
});
