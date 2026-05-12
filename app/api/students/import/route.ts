import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { parseStudentsCsv, REQUIRED_FIELDS } from "@/modules/students/csv";

export async function POST(req: Request) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "STUDENTS");

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const snapshotDateRaw = String(form.get("snapshotDate") || "");
  const mappingJsonRaw = String(form.get("mappingJson") || "{}");
  if (!file || !snapshotDateRaw) return NextResponse.json({ error: "file and snapshotDate required" }, { status: 400 });

  const mapping = JSON.parse(mappingJsonRaw) as Record<string, string>;
  const missing = REQUIRED_FIELDS.filter((f) => !mapping[f]);
  if (missing.length) return NextResponse.json({ error: `missing required mappings: ${missing.join(", ")}` }, { status: 400 });

  await (prisma as any).importMappingConfig.upsert({
    where: { tenantId_importType: { tenantId: user.tenantId, importType: "STUDENTS_SNAPSHOT" } },
    create: { tenantId: user.tenantId, importType: "STUDENTS_SNAPSHOT", mappingJson: mapping },
    update: { mappingJson: mapping }
  });

  const importJob = await (prisma as any).importJob.create({
    data: {
      tenantId: user.tenantId,
      type: "STUDENTS_SNAPSHOT",
      status: "PROCESSING",
      uploadedBy: user.id,
      fileName: file.name,
      rowCount: 0
    }
  });

  const text = await file.text();
  const { parsed, errors, preview } = parseStudentsCsv(text, mapping);

  for (const err of errors) {
    await (prisma as any).importError.create({ data: { importJobId: importJob.id, rowNumber: err.rowNumber, field: err.field, message: err.message } });
  }

  if (!errors.length) {
    const snapshotDate = new Date(snapshotDateRaw);
    for (const row of parsed) {
      const student = await (prisma as any).student.upsert({
        where: { tenantId_upn: { tenantId: user.tenantId, upn: row.upn } },
        create: {
          tenantId: user.tenantId,
          upn: row.upn,
          fullName: row.fullName,
          yearGroup: row.yearGroup,
          ks2ReadingScaledScore: row.ks2ReadingScaledScore,
          ks2MathsScaledScore: row.ks2MathsScaledScore,
          sendFlag: row.sendFlag,
          ppFlag: row.ppFlag,
          status: row.status
        },
        update: {
          fullName: row.fullName,
          yearGroup: row.yearGroup,
          ks2ReadingScaledScore: row.ks2ReadingScaledScore,
          ks2MathsScaledScore: row.ks2MathsScaledScore,
          sendFlag: row.sendFlag,
          ppFlag: row.ppFlag,
          status: row.status
        }
      });

      await (prisma as any).studentSnapshot.upsert({
        where: { tenantId_studentId_snapshotDate: { tenantId: user.tenantId, studentId: student.id, snapshotDate } },
        create: {
          tenantId: user.tenantId,
          studentId: student.id,
          snapshotDate,
          positivePointsTotal: row.positivePointsTotal,
          detentionsCount: row.detentionsCount,
          internalExclusionsCount: row.internalExclusionsCount,
          suspensionsCount: row.suspensionsCount,
          onCallsCount: row.onCallsCount,
          attendancePct: row.attendancePct,
          latenessCount: row.latenessCount
        },
        update: {
          positivePointsTotal: row.positivePointsTotal,
          detentionsCount: row.detentionsCount,
          internalExclusionsCount: row.internalExclusionsCount,
          suspensionsCount: row.suspensionsCount,
          onCallsCount: row.onCallsCount,
          attendancePct: row.attendancePct,
          latenessCount: row.latenessCount
        }
      });
    }
  }

  await (prisma as any).importJob.update({
    where: { id: importJob.id },
    data: {
      rowCount: parsed.length,
      status: errors.length ? "FAILED" : "COMPLETED",
      errorSummary: errors.length ? `${errors.length} validation errors` : null
    }
  });

  return NextResponse.json({ importJobId: importJob.id, preview, errors, rowCount: parsed.length });
}
