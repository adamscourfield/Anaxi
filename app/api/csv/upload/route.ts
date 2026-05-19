import { NextResponse } from "next/server";
import { parseStudentCsv } from "@/modules/students/csv";
import { prisma } from "@/lib/prisma";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature, requireRole } from "@/lib/guards";
import { withApi } from "@/lib/apiRoute";

export const POST = withApi(async function POST(req: Request) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "STUDENTS");
  requireRole(user, ["LEADER", "SLT", "ADMIN"]);

  const form = await req.formData();
  const csvFile = form.get("file") as File | null;
  const snapshotDateRaw = String(form.get("snapshotDate") || "");
  if (!csvFile || !snapshotDateRaw) {
    return NextResponse.json({ error: "file and snapshotDate are required" }, { status: 400 });
  }

  const text = await csvFile.text();
  const parsed = parseStudentCsv(text);
  const errors: string[] = [];
  parsed.forEach((row, idx) => {
    if (!row.externalId) errors.push(`Row ${idx + 1}: externalId missing`);
  });

  await prisma.importJob.create({
    data: {
      tenantId: user.tenantId,
      type: "STUDENTS_SNAPSHOT",
      status: errors.length ? "FAILED" : "SUCCESS",
      uploadedBy: user.id,
      fileName: csvFile.name,
      rowCount: parsed.length,
      errorSummary: errors.length ? errors.join("; ") : null
    }
  });

  return NextResponse.json({ totalRows: parsed.length, preview: parsed.slice(0, 20), errors });
});
