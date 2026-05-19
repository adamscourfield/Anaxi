import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/apiErrors";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { hasPermission } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { parseSubjectTeacherCsv } from "@/modules/students/csv";

export async function POST(req: Request) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "STUDENTS");
  if (!hasPermission(user.role, "import:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "file required" }, { status: 400 });

  const job = await (prisma as any).importJob.create({
    data: {
      tenantId: user.tenantId,
      type: "STUDENT_SUBJECT_TEACHERS",
      status: "PROCESSING",
      uploadedBy: user.id,
      fileName: file.name,
      rowCount: 0,
      startedAt: new Date(),
    }
  });

  try {
    const rows = parseSubjectTeacherCsv(await file.text());
    const errors: Array<{ rowNumber: number; field: string; message: string }> = [];

    for (const [idx, row] of rows.entries()) {
      const rowNumber = idx + 1;
      const student = await (prisma as any).student.findUnique({ where: { tenantId_upn: { tenantId: user.tenantId, upn: row.UPN } } });
      if (!student) {
        errors.push({ rowNumber, field: "UPN", message: "Student not found" });
        continue;
      }

      const teacher = await (prisma as any).user.findFirst({ where: { tenantId: user.tenantId, email: row.TeacherEmail.toLowerCase() } });
      if (!teacher) {
        errors.push({ rowNumber, field: "TeacherEmail", message: "Teacher not found" });
        continue;
      }

      const subject = await (prisma as any).subject.upsert({
        where: { tenantId_name: { tenantId: user.tenantId, name: row.Subject } },
        create: { tenantId: user.tenantId, name: row.Subject },
        update: {}
      });

      const effectiveFrom = new Date(row.EffectiveFrom);
      const effectiveTo = row.EffectiveTo ? new Date(row.EffectiveTo) : null;

      try {
        await prisma.$transaction(async (tx) => {
          const overlapping = await (tx as any).studentSubjectTeacher.findFirst({
            where: {
              tenantId: user.tenantId,
              studentId: student.id,
              subjectId: subject.id,
              OR: [
                { effectiveTo: null },
                { AND: [{ effectiveFrom: { lte: effectiveTo || new Date("9999-12-31") } }, { effectiveTo: { gte: effectiveFrom } }] }
              ]
            }
          });

          if (overlapping) {
            throw new Error("OVERLAP");
          }

          await (tx as any).studentSubjectTeacher.create({
            data: { tenantId: user.tenantId, studentId: student.id, subjectId: subject.id, teacherId: teacher.id, effectiveFrom, effectiveTo }
          });
        });
      } catch (err) {
        const message = err instanceof Error && err.message === "OVERLAP"
          ? "Overlapping mapping exists"
          : `Failed to write mapping: ${String((err as any)?.message ?? err)}`;
        errors.push({ rowNumber, field: "EffectiveFrom", message });
      }
    }

    if (errors.length > 0) {
      await (prisma as any).importError.createMany({
        data: errors.map((err) => ({ importJobId: job.id, rowNumber: err.rowNumber, field: err.field, message: err.message }))
      });
    }

    await (prisma as any).importJob.update({
      where: { id: job.id },
      data: {
        rowCount: rows.length,
        rowsProcessed: rows.length - errors.length,
        rowsFailed: errors.length,
        status: errors.length ? "FAILED" : "COMPLETED",
        errorSummary: errors.length ? `${errors.length} errors` : null,
        finishedAt: new Date(),
      }
    });

    logger.info("import.subject-teachers.completed", {
      tenantId: user.tenantId,
      importJobId: job.id,
      rowCount: rows.length,
      errorCount: errors.length,
    });
    return NextResponse.json({ importJobId: job.id, rowCount: rows.length, errors });
  } catch (err) {
    await (prisma as any).importJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        errorSummary: String((err as any)?.message ?? err),
        finishedAt: new Date(),
      }
    });
    logger.error("import.subject-teachers.failed", {
      tenantId: user.tenantId,
      importJobId: job.id,
      error: String((err as any)?.message ?? err),
    });
    return apiErrorResponse(err, "Import failed");
  }
}
