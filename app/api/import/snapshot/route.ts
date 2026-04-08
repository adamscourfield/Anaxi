import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { hasPermission } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { parseSnapshotCsv, SnapshotMapping } from "@/modules/students/snapshot-import";
import { computeHeaderSignature } from "@/modules/students/snapshot-fields";

export async function POST(req: Request) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "STUDENTS_IMPORT");
  if (!hasPermission(user.role, "import:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const mappingRaw = String(form.get("mapping") ?? "{}");
  const saveMapping = form.get("saveMapping") === "true";
  const mappingName = String(form.get("mappingName") ?? "Snapshot import mapping");

  if (!file) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  let mapping: SnapshotMapping;
  try {
    mapping = JSON.parse(mappingRaw) as SnapshotMapping;
  } catch {
    return NextResponse.json({ error: "Invalid mapping JSON" }, { status: 400 });
  }

  const text = await file.text();
  const firstLine = text.split("\n")[0] ?? "";
  const headers = firstLine.split(",").map((h) => h.trim());
  const headerSignature = computeHeaderSignature(headers);

  // Create import job
  const importJob = await (prisma as any).importJob.create({
    data: {
      tenantId: user.tenantId,
      type: "STUDENT_SNAPSHOT",
      status: "RUNNING",
      uploadedBy: user.id,
      fileName: file.name,
      rowCount: 0,
      startedAt: new Date(),
    },
  });

  try {
    const { rows, errors } = parseSnapshotCsv(text, mapping, new Date());

    // Save errors to DB
    const errorCountsByCode: Record<string, number> = {};
    for (const err of errors) {
      errorCountsByCode[err.errorCode] = (errorCountsByCode[err.errorCode] ?? 0) + 1;
    }

    if (errors.length > 0) {
      await (prisma as any).importError.createMany({
        data: errors.slice(0, 500).map((e) => ({
          importJobId: importJob.id,
          rowNumber: e.rowNumber,
          field: e.errorCode,
          message: e.message,
        })),
      });
    }

    let rowsProcessed = 0;
    let rowsFailed = errors.length;

    // Upsert valid rows
    for (const row of rows) {
      try {
        const student = await (prisma as any).student.upsert({
          where: { tenantId_upn: { tenantId: user.tenantId, upn: row.upn } },
          create: {
            tenantId: user.tenantId,
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
              tenantId: user.tenantId,
              studentId: student.id,
              snapshotDate: row.snapshotDate,
            },
          },
          create: {
            tenantId: user.tenantId,
            studentId: student.id,
            snapshotDate: row.snapshotDate,
            countScope: row.countScope,
            positivePointsTotal: row.positivePoints,
            detentionsCount: row.detentions,
            internalExclusionsCount: row.internalExclusions,
            suspensionsCount: row.suspensions,
            attendancePct: row.attendancePercent,
            latenessCount: row.lates,
          },
          update: {
            countScope: row.countScope,
            positivePointsTotal: row.positivePoints,
            detentionsCount: row.detentions,
            internalExclusionsCount: row.internalExclusions,
            suspensionsCount: row.suspensions,
            attendancePct: row.attendancePercent,
            latenessCount: row.lates,
          },
        });

        rowsProcessed++;
      } catch (dbErr: any) {
        rowsFailed++;
        await (prisma as any).importError.create({
          data: {
            importJobId: importJob.id,
            rowNumber: 0,
            field: "DB_ERROR",
            message: String(dbErr?.message ?? dbErr),
          },
        });
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
      where: { id: importJob.id },
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

    // Save mapping if requested
    if (saveMapping) {
      await (prisma as any).tenantImportMapping.create({
        data: {
          tenantId: user.tenantId,
          type: "STUDENT_SNAPSHOT",
          name: mappingName,
          mappingJson: mapping as any,
          fixedCountScope: mapping.fixedCountScope ?? null,
          headerSignature,
          createdByUserId: user.id,
        },
      });
    }

    logger.info("import.snapshot.completed", {
      tenantId: user.tenantId,
      importJobId: importJob.id,
      rowsProcessed,
      rowsFailed,
    });
    return NextResponse.json({
      importJobId: importJob.id,
      rowsProcessed,
      rowsFailed,
      errorReportJson,
    });
  } catch (err: any) {
    await (prisma as any).importJob.update({
      where: { id: importJob.id },
      data: {
        status: "FAILED",
        errorSummary: String(err?.message ?? err),
        finishedAt: new Date(),
      },
    });
    logger.error("import.snapshot.failed", {
      tenantId: user.tenantId,
      importJobId: importJob.id,
      error: String(err?.message ?? err),
    });
    return NextResponse.json({ error: "Import failed", detail: String(err?.message ?? err) }, { status: 500 });
  }
}
