/**
 * Assessment Import Orchestration
 *
 * Handles the end-to-end flow of importing assessment results from a parsed
 * CSV into the database. Follows the same pattern as snapshot-import.ts:
 * - Upsert students by UPN
 * - Upsert AssessmentResult records
 * - Track errors per row
 * - Return a summary
 */

import { prisma } from "@/lib/prisma";
import { normalizeGrade, detectNonGradeStatus } from "./gradeNormalizer";
import type { AssessmentCsvRecord } from "./csv";
import type { GradeFormat } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ImportAssessmentResultsOptions = {
  tenantId: string;
  assessmentId: string;
  gradeFormat: GradeFormat;
  maxScore?: number | null;
  uploadedByUserId: string;
  fileName: string;
};

export type ImportAssessmentResultsSummary = {
  importJobId: string;
  rowsProcessed: number;
  rowsFailed: number;
  errors: Array<{ rowNumber: number; field: string; message: string }>;
};

// ─── Main import function ─────────────────────────────────────────────────────

export async function importAssessmentResults(
  records: AssessmentCsvRecord[],
  errors: Array<{ rowNumber: number; field: string; message: string }>,
  options: ImportAssessmentResultsOptions
): Promise<ImportAssessmentResultsSummary> {
  const { tenantId, assessmentId, gradeFormat, maxScore, uploadedByUserId, fileName } = options;

  // Verify the assessment exists and belongs to this tenant
  const assessment = await prisma.assessment.findFirst({
    where: { id: assessmentId, tenantId },
  });
  if (!assessment) throw new Error(`Assessment ${assessmentId} not found`);

  // Create the import job
  const importJob = await prisma.importJob.create({
    data: {
      tenantId,
      type: "ASSESSMENT_RESULTS",
      status: "RUNNING",
      uploadedBy: uploadedByUserId,
      fileName,
      rowCount: records.length,
      startedAt: new Date(),
    },
  });

  // Build student lookup: prefer UPN, fall back to name-based matching
  const upns = [...new Set(records.map((r) => r.upn).filter(Boolean))];
  const names = [...new Set(records.map((r) => r.studentName).filter(Boolean))];

  const allStudents = await prisma.student.findMany({
    where: {
      tenantId,
      OR: [
        ...(upns.length > 0 ? [{ upn: { in: upns } }] : []),
        ...(names.length > 0 ? [{ fullName: { in: names } }] : []),
      ],
    },
    select: { id: true, upn: true, fullName: true },
  });

  const studentByUpn = new Map(
    allStudents.filter((s) => s.upn).map((s) => [s.upn!, s.id])
  );
  // Name lookup: lowercase for case-insensitive matching
  const studentByName = new Map(
    allStudents.map((s) => [s.fullName.toLowerCase().trim(), s.id])
  );

  let rowsProcessed = 0;
  let rowsFailed = 0;
  const rowErrors: Array<{ rowNumber: number; field: string; message: string }> = [...errors];

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const rowNum = i + 2; // 1-indexed + header row

    // Resolve student ID: UPN first, then name
    let studentId = record.upn ? studentByUpn.get(record.upn) : undefined;
    if (!studentId && record.studentName) {
      studentId = studentByName.get(record.studentName.toLowerCase().trim());
    }
    if (!studentId) {
      const identifier = record.upn || record.studentName || "unknown";
      rowErrors.push({
        rowNumber: rowNum,
        field: record.upn ? "UPN" : "Name",
        message: `No student found matching "${identifier}"`,
      });
      rowsFailed++;
      continue;
    }

    // Detect non-grade status (absent/withdrawn)
    const nonGradeStatus = detectNonGradeStatus(record.rawValue);
    const status = nonGradeStatus ?? "PRESENT";
    const normalizedScore = nonGradeStatus
      ? null
      : normalizeGrade(record.rawValue, gradeFormat, maxScore);

    try {
      await prisma.assessmentResult.upsert({
        where: {
          tenantId_assessmentId_studentId: {
            tenantId,
            assessmentId,
            studentId,
          },
        },
        update: {
          rawValue: record.rawValue,
          normalizedScore,
          status,
          updatedAt: new Date(),
        },
        create: {
          tenantId,
          assessmentId,
          studentId,
          rawValue: record.rawValue,
          normalizedScore,
          status,
        },
      });
      rowsProcessed++;
    } catch (err) {
      rowErrors.push({
        rowNumber: rowNum,
        field: "Grade",
        message: err instanceof Error ? err.message : "Failed to save result",
      });
      rowsFailed++;
    }
  }

  // Compute and store competition ranks for all PRESENT results in this assessment
  await computeAndStoreRanks(tenantId, assessmentId);

  // Update import job
  await prisma.importJob.update({
    where: { id: importJob.id },
    data: {
      status: rowsFailed === 0 ? "SUCCESS" : rowsFailed === records.length ? "FAILED" : "COMPLETED",
      rowsProcessed,
      rowsFailed,
      finishedAt: new Date(),
      errorSummary:
        rowErrors.length > 0
          ? `${rowErrors.length} error(s) during import`
          : null,
      errorReportJson: rowErrors.length > 0 ? (rowErrors as any) : undefined,
    },
  });

  // Store row-level errors
  if (rowErrors.length > 0) {
    await prisma.importError.createMany({
      data: rowErrors.map((e) => ({
        importJobId: importJob.id,
        rowNumber: e.rowNumber,
        field: e.field,
        message: e.message,
      })),
    });
  }

  return {
    importJobId: importJob.id,
    rowsProcessed,
    rowsFailed,
    errors: rowErrors,
  };
}

// ─── Assessment setup helpers ─────────────────────────────────────────────────

export type CreateAssessmentInput = {
  tenantId: string;
  pointId: string;
  subject: string;
  yearGroup: string;
  title: string;
  gradeFormat: GradeFormat;
  maxScore?: number;
  createdByUserId: string;
};

export async function createAssessment(input: CreateAssessmentInput) {
  return prisma.assessment.create({
    data: {
      tenantId: input.tenantId,
      pointId: input.pointId,
      subject: input.subject,
      yearGroup: input.yearGroup,
      title: input.title,
      gradeFormat: input.gradeFormat,
      maxScore: input.maxScore ?? null,
      createdByUserId: input.createdByUserId,
    },
    include: { point: { include: { cycle: true } } },
  });
}

export type CreateCycleInput = {
  tenantId: string;
  label: string;
  startDate: Date;
  endDate: Date;
};

export async function createAssessmentCycle(input: CreateCycleInput) {
  return prisma.assessmentCycle.create({
    data: {
      tenantId: input.tenantId,
      label: input.label,
      startDate: input.startDate,
      endDate: input.endDate,
      isActive: true,
    },
  });
}

export type CreatePointInput = {
  tenantId: string;
  cycleId: string;
  label: string;
  ordinal: number;
  assessedAt: Date;
};

export async function createAssessmentPoint(input: CreatePointInput) {
  return prisma.assessmentPoint.create({
    data: {
      tenantId: input.tenantId,
      cycleId: input.cycleId,
      label: input.label,
      ordinal: input.ordinal,
      assessedAt: input.assessedAt,
    },
  });
}

// ─── Rank computation ─────────────────────────────────────────────────────────

/**
 * Computes competition ranks (1-2-2-4 style) for all PRESENT results in an
 * assessment, ordered by normalizedScore descending, and persists them.
 * Results with a null normalizedScore receive a null rank.
 */
async function computeAndStoreRanks(tenantId: string, assessmentId: string) {
  const results = await prisma.assessmentResult.findMany({
    where: { tenantId, assessmentId, status: "PRESENT" },
    select: { id: true, normalizedScore: true },
    orderBy: { normalizedScore: "desc" },
  });

  // Separate scored from unscored
  const scored = results.filter((r) => r.normalizedScore !== null);
  const unscored = results.filter((r) => r.normalizedScore === null);

  // Assign competition ranks to scored results
  const updates: Array<{ id: string; rank: number | null }> = [];
  let rank = 1;
  for (let i = 0; i < scored.length; i++) {
    if (i > 0 && scored[i].normalizedScore !== scored[i - 1].normalizedScore) {
      rank = i + 1;
    }
    updates.push({ id: scored[i].id, rank });
  }
  for (const r of unscored) {
    updates.push({ id: r.id, rank: null });
  }

  // Batch update — Prisma doesn't support bulk updates so use a transaction
  await prisma.$transaction(
    updates.map(({ id, rank }) =>
      prisma.assessmentResult.update({ where: { id }, data: { rank } })
    )
  );
}

// ─── Direct input (single result) ────────────────────────────────────────────

export type UpsertSingleResultInput = {
  tenantId: string;
  assessmentId: string;
  studentId: string;
  rawValue: string;
  gradeFormat: GradeFormat;
  maxScore?: number | null;
};

export async function upsertSingleResult(input: UpsertSingleResultInput) {
  const { tenantId, assessmentId, studentId, rawValue, gradeFormat, maxScore } = input;
  const nonGradeStatus = detectNonGradeStatus(rawValue);
  const status = nonGradeStatus ?? "PRESENT";
  const normalizedScore = nonGradeStatus ? null : normalizeGrade(rawValue, gradeFormat, maxScore);

  await prisma.assessmentResult.upsert({
    where: { tenantId_assessmentId_studentId: { tenantId, assessmentId, studentId } },
    update: { rawValue, normalizedScore, status, updatedAt: new Date() },
    create: { tenantId, assessmentId, studentId, rawValue, normalizedScore, status },
  });

  await computeAndStoreRanks(tenantId, assessmentId);

  return prisma.assessmentResult.findUniqueOrThrow({
    where: { tenantId_assessmentId_studentId: { tenantId, assessmentId, studentId } },
  });
}
