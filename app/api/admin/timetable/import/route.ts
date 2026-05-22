import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireRole } from "@/lib/guards";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { parseTimetableCsv, TimetableMapping } from "@/modules/timetable/timetable-import";
import { computeHeaderSignature } from "@/modules/timetable/timetable-fields";
import { apiErrorResponse } from "@/lib/apiErrors";

export async function POST(req: Request) {
  const user = await getSessionUserOrThrow();
  requireRole(user, ["ADMIN"]);

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const mappingRaw = String(form.get("mapping") ?? "{}");
  const saveMapping = form.get("saveMapping") === "true";
  const mappingName = String(form.get("mappingName") ?? "Timetable import mapping");

  if (!file) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  let mapping: TimetableMapping;
  try {
    mapping = JSON.parse(mappingRaw) as TimetableMapping;
  } catch {
    return NextResponse.json({ error: "Invalid mapping JSON" }, { status: 400 });
  }

  const text = await file.text();
  const firstLine = text.split("\n")[0] ?? "";
  const headers = firstLine.split(",").map((h) => h.trim());
  const headerSignature = computeHeaderSignature(headers);

  // Create import job
  const importJob = await (prisma as any).timetableImportJob.create({
    data: {
      tenantId: user.tenantId,
      status: "RUNNING",
      uploadedByUserId: user.id,
      fileName: file.name,
      rowCount: 0,
    },
  });

  try {
    const { rows, errors, conflicts } = parseTimetableCsv(text, mapping);

    // Look up teachers by email (case-insensitive)
    const allUsers = await (prisma as any).user.findMany({
      where: { tenantId: user.tenantId },
      select: { id: true, email: true },
    });
    const userByEmail = new Map<string, string>(
      (allUsers as Array<{ id: string; email: string }>).map((u) => [
        u.email.toLowerCase(),
        u.id,
      ]),
    );

    // Flag rows whose teacherEmail doesn't match a user as additional conflicts
    const allConflicts = [...conflicts];
    for (const row of rows) {
      const teacherId = userByEmail.get(row.teacherEmail.toLowerCase()) ?? null;
      if (!teacherId) {
        allConflicts.push({
          rowNumber: row.rowNumber,
          classCode: row.classCode,
          teacherEmail: row.teacherEmail,
          conflictCode: "UNKNOWN_TEACHER_EMAIL",
          message: `TeacherEmail "${row.teacherEmail}" does not match any staff member`,
        });
      }
    }

    const conflictErrors = allConflicts.map((c) => ({
      rowNumber: c.rowNumber,
      classCode: c.classCode,
      errorCode: c.conflictCode,
      message: c.message,
    }));
    const allErrors = [...errors, ...conflictErrors];
    const rowsFailed = allErrors.length;

    // Fail closed on parser/validation issues and keep existing timetable intact.
    if (rowsFailed > 0) {
      await (prisma as any).timetableImportJob.update({
        where: { id: importJob.id },
        data: {
          status: "FAILED",
          rowCount: rows.length + errors.length,
          rowsProcessed: 0,
          rowsFailed,
          errorReportJson: allErrors,
          conflictsJson: allConflicts.length > 0 ? allConflicts : null,
          finishedAt: new Date(),
        },
      });

      logger.warn("import.timetable.failed-validation", {
        tenantId: user.tenantId,
        importJobId: importJob.id,
        rowsFailed,
        conflictCount: allConflicts.length,
      });
      return NextResponse.json({
        importJobId: importJob.id,
        rowsProcessed: 0,
        rowsFailed,
        conflictCount: allConflicts.length,
      });
    }

    const entriesToCreate = rows.map((row) => ({
      tenantId: user.tenantId,
      classCode: row.classCode,
      subject: row.subject,
      yearGroup: row.yearGroup,
      teacherUserId: userByEmail.get(row.teacherEmail.toLowerCase()) ?? null,
      teacherEmailRaw: row.teacherEmail,
      room: row.room,
      dayOfWeek: row.dayOfWeek,
      period: row.period,
      weekPattern: row.weekPattern,
      startTime: row.startTime,
      endTime: row.endTime,
      slotKey: row.slotKey,
    }));

    await prisma.$transaction(async (tx) => {
      await (tx as any).timetableEntry.deleteMany({ where: { tenantId: user.tenantId } });
      await (tx as any).timetableEntry.createMany({ data: entriesToCreate });
    });

    const rowsProcessed = entriesToCreate.length;

    await (prisma as any).timetableImportJob.update({
      where: { id: importJob.id },
      data: {
        status: "SUCCESS",
        rowCount: rows.length + errors.length,
        rowsProcessed,
        rowsFailed,
        errorReportJson: allErrors.length > 0 ? allErrors : null,
        conflictsJson: allConflicts.length > 0 ? allConflicts : null,
        finishedAt: new Date(),
      },
    });

    // Save mapping if requested
    if (saveMapping) {
      await (prisma as any).tenantImportMapping.create({
        data: {
          tenantId: user.tenantId,
          type: "TIMETABLE",
          name: mappingName,
          mappingJson: mapping as object,
          headerSignature,
          createdByUserId: user.id,
        },
      });
    }

    logger.info("import.timetable.completed", {
      tenantId: user.tenantId,
      importJobId: importJob.id,
      rowsProcessed,
      rowsFailed,
      conflictCount: allConflicts.length,
    });
    return NextResponse.json({
      importJobId: importJob.id,
      rowsProcessed,
      rowsFailed,
      conflictCount: allConflicts.length,
    });
  } catch (err) {
    await (prisma as any).timetableImportJob.update({
      where: { id: importJob.id },
      data: {
        status: "FAILED",
        errorReportJson: [
          {
            rowNumber: 0,
            errorCode: "IMPORT_ERROR",
            message: err instanceof Error ? err.message : "Timetable import failed",
          },
        ],
        finishedAt: new Date(),
      },
    });
    return apiErrorResponse(err);
  }
}
