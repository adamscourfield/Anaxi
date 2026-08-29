import { prisma } from "@/lib/prisma";
import { parseSnapshotCsv, type SnapshotMapping } from "@/modules/students/snapshot-import";

export type RunSnapshotImportInput = {
  tenantId: string;
  importJobId: string;
  csvText: string;
  mapping: SnapshotMapping;
  fallbackDate?: Date;
};

export type RunSnapshotImportResult = {
  rowsProcessed: number;
  rowsFailed: number;
  errorReportJson: {
    totalRows: number;
    rowsProcessed: number;
    rowsFailed: number;
    errorCountsByCode: Record<string, number>;
    sampleErrors: Array<{ rowNumber: number; errorCode: string; message: string }>;
  };
};

export async function runSnapshotImport(input: RunSnapshotImportInput): Promise<RunSnapshotImportResult> {
  const { tenantId, importJobId, csvText, mapping } = input;
  const fallbackDate = input.fallbackDate ?? new Date();

  const { rows, errors } = parseSnapshotCsv(csvText, mapping, fallbackDate);

  const errorCountsByCode: Record<string, number> = {};
  for (const err of errors) {
    errorCountsByCode[err.errorCode] = (errorCountsByCode[err.errorCode] ?? 0) + 1;
  }

  if (errors.length > 0) {
    await (prisma as any).importError.createMany({
      data: errors.slice(0, 500).map((e) => ({
        importJobId,
        rowNumber: e.rowNumber,
        field: e.errorCode,
        message: e.message,
      })),
    });
  }

  let rowsProcessed = 0;
  let rowsFailed = errors.length;

  const ROW_CONCURRENCY = 10;

  async function importRow(row: (typeof rows)[number]): Promise<void> {
    const student = await (prisma as any).student.upsert({
      where: { tenantId_upn: { tenantId, upn: row.upn } },
      create: {
        tenantId,
        upn: row.upn,
        fullName: row.studentName,
        yearGroup: row.yearGroup,
        sendFlag: row.send,
        ppFlag: row.pp,
        status: "ACTIVE",
      },
      update: {
        fullName: row.studentName,
        yearGroup: row.yearGroup,
        sendFlag: row.send,
        ppFlag: row.pp,
      },
    });

    await (prisma as any).studentSnapshot.upsert({
      where: {
        tenantId_studentId_snapshotDate: {
          tenantId,
          studentId: student.id,
          snapshotDate: row.snapshotDate,
        },
      },
      create: {
        tenantId,
        studentId: student.id,
        snapshotDate: row.snapshotDate,
        positivePointsTotal: row.positivePoints,
        detentionsCount: row.detentions,
        internalExclusionsCount: row.internalExclusions,
        suspensionsCount: row.suspensions,
        attendancePct: row.attendancePercent,
        latenessCount: row.lates,
      },
      update: {
        positivePointsTotal: row.positivePoints,
        detentionsCount: row.detentions,
        internalExclusionsCount: row.internalExclusions,
        suspensionsCount: row.suspensions,
        attendancePct: row.attendancePercent,
        latenessCount: row.lates,
      },
    });
  }

  for (let i = 0; i < rows.length; i += ROW_CONCURRENCY) {
    const batch = rows.slice(i, i + ROW_CONCURRENCY);
    const outcomes = await Promise.allSettled(batch.map(importRow));

    for (const outcome of outcomes) {
      if (outcome.status === "fulfilled") {
        rowsProcessed++;
      } else {
        rowsFailed++;
        await (prisma as any).importError.create({
          data: {
            importJobId,
            rowNumber: 0,
            field: "DB_ERROR",
            message: String(outcome.reason instanceof Error ? outcome.reason.message : outcome.reason),
          },
        });
      }
    }
  }

  const errorReportJson = {
    totalRows: rows.length + errors.length,
    rowsProcessed,
    rowsFailed,
    errorCountsByCode,
    sampleErrors: errors.slice(0, 25),
  };

  await (prisma as any).importJob.update({
    where: { id: importJobId },
    data: {
      status: rowsFailed === 0 ? "SUCCESS" : "FAILED",
      rowCount: rows.length + errors.length,
      rowsProcessed,
      rowsFailed,
      errorReportJson,
      errorSummary: rowsFailed > 0 ? `${rowsFailed} rows had issues` : null,
      finishedAt: new Date(),
    },
  });

  return { rowsProcessed, rowsFailed, errorReportJson };
}
