import { prisma } from "@/lib/prisma";
import { readImportFile } from "@/lib/importStorage";
import { failedImportStatus, successImportStatus } from "@/lib/importJobStatus";
import { logger } from "@/lib/logger";
import { notifyImportFinished } from "@/lib/inAppNotifications";
import { runSnapshotImport } from "@/modules/students/runSnapshotImport";
import type { SnapshotMapping } from "@/modules/students/snapshot-import";
import { parseStudentsCsv } from "@/modules/students/csv";
import type { ImportJob } from "@prisma/client";

const BATCH_SIZE = 5;

async function processStudentSnapshotJob(job: ImportJob): Promise<void> {
  if (!job.storagePath) {
    throw new Error("Import job missing storagePath");
  }
  const csvText = await readImportFile(job.storagePath);
  const mapping = (job.mappingJson ?? {}) as unknown as SnapshotMapping;
  await runSnapshotImport({
    tenantId: job.tenantId,
    importJobId: job.id,
    csvText,
    mapping,
  });
}

async function processStudentsSnapshotJob(job: ImportJob): Promise<void> {
  if (!job.storagePath) {
    throw new Error("Import job missing storagePath");
  }
  const csvText = await readImportFile(job.storagePath);
  const rawMapping = (job.mappingJson ?? {}) as unknown as Record<string, string> & {
    _snapshotDate?: string;
  };
  const snapshotDateRaw = rawMapping._snapshotDate;
  if (!snapshotDateRaw) {
    throw new Error("Missing snapshotDate on import job");
  }
  const mapping = { ...rawMapping };
  delete mapping._snapshotDate;

  const { parsed, errors } = parseStudentsCsv(csvText, mapping);
  for (const err of errors) {
    await prisma.importError.create({
      data: {
        importJobId: job.id,
        rowNumber: err.rowNumber,
        field: err.field,
        message: err.message,
      },
    });
  }

  if (!errors.length) {
    const snapshotDate = new Date(snapshotDateRaw);
    for (const row of parsed) {
      const student = await prisma.student.upsert({
        where: { tenantId_upn: { tenantId: job.tenantId, upn: row.upn } },
        create: {
          tenantId: job.tenantId,
          upn: row.upn,
          fullName: row.fullName,
          yearGroup: row.yearGroup,
          ks2ReadingScaledScore: row.ks2ReadingScaledScore,
          ks2MathsScaledScore: row.ks2MathsScaledScore,
          sendFlag: row.sendFlag,
          ppFlag: row.ppFlag,
          status: row.status,
        },
        update: {
          fullName: row.fullName,
          yearGroup: row.yearGroup,
          ks2ReadingScaledScore: row.ks2ReadingScaledScore,
          ks2MathsScaledScore: row.ks2MathsScaledScore,
          sendFlag: row.sendFlag,
          ppFlag: row.ppFlag,
          status: row.status,
        },
      });

      await prisma.studentSnapshot.upsert({
        where: {
          tenantId_studentId_snapshotDate: {
            tenantId: job.tenantId,
            studentId: student.id,
            snapshotDate,
          },
        },
        create: {
          tenantId: job.tenantId,
          studentId: student.id,
          snapshotDate,
          positivePointsTotal: row.positivePointsTotal,
          detentionsCount: row.detentionsCount,
          internalExclusionsCount: row.internalExclusionsCount,
          suspensionsCount: row.suspensionsCount,
          onCallsCount: row.onCallsCount,
          attendancePct: row.attendancePct,
          latenessCount: row.latenessCount,
        },
        update: {
          positivePointsTotal: row.positivePointsTotal,
          detentionsCount: row.detentionsCount,
          internalExclusionsCount: row.internalExclusionsCount,
          suspensionsCount: row.suspensionsCount,
          onCallsCount: row.onCallsCount,
          attendancePct: row.attendancePct,
          latenessCount: row.latenessCount,
        },
      });
    }
  }

  await prisma.importJob.update({
    where: { id: job.id },
    data: {
      rowCount: parsed.length,
      status: errors.length ? failedImportStatus() : successImportStatus(),
      errorSummary: errors.length ? `${errors.length} validation errors` : null,
      finishedAt: new Date(),
    },
  });
}

export async function processImportJob(jobId: string): Promise<void> {
  const job = await prisma.importJob.findUnique({ where: { id: jobId } });
  if (!job || job.status !== "PENDING") return;

  await prisma.importJob.update({
    where: { id: job.id },
    data: { status: "PROCESSING", startedAt: new Date() },
  });

  try {
    if (job.type === "STUDENT_SNAPSHOT") {
      await processStudentSnapshotJob(job);
    } else if (job.type === "STUDENTS_SNAPSHOT") {
      await processStudentsSnapshotJob(job);
    } else {
      await prisma.importJob.update({
        where: { id: job.id },
        data: {
          status: failedImportStatus(),
          errorSummary: `Unsupported async import type: ${job.type}`,
          finishedAt: new Date(),
        },
      });
      return;
    }

    const finished = await prisma.importJob.findUnique({ where: { id: job.id } });
    if (finished) {
      await notifyImportFinished({
        tenantId: job.tenantId,
        userId: job.uploadedBy,
        importJobId: job.id,
        fileName: job.fileName,
        rowsFailed: finished.rowsFailed,
      });
    }
  } catch (err) {
    logger.error("import.job.failed", {
      importJobId: job.id,
      error: err instanceof Error ? err.message : String(err),
    });
    await prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: failedImportStatus(),
        errorSummary: err instanceof Error ? err.message : "Import failed",
        finishedAt: new Date(),
      },
    });
  }
}

export async function processPendingImportJobs(limit = BATCH_SIZE): Promise<number> {
  const pending = await prisma.importJob.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  for (const job of pending) {
    await processImportJob(job.id);
  }

  return pending.length;
}
