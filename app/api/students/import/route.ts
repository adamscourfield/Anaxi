import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/apiErrors";
import { requireFeature } from "@/lib/guards";
import { hasPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { saveImportFile } from "@/lib/importStorage";
import { REQUIRED_FIELDS } from "@/modules/students/csv";
import { processImportJob } from "@/modules/import/processPendingJobs";

export async function POST(req: Request) {
  try {
    const user = await getSessionUserOrThrow();
    await requireFeature(user.tenantId, "STUDENTS");
    if (!hasPermission(user.role, "import:write")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const form = await req.formData();
    const file = form.get("file") as File | null;
    const snapshotDateRaw = String(form.get("snapshotDate") || "");
    const mappingJsonRaw = String(form.get("mappingJson") || "{}");
    if (!file || !snapshotDateRaw) {
      return NextResponse.json({ error: "file and snapshotDate required" }, { status: 400 });
    }

    let mapping: Record<string, string>;
    try {
      mapping = JSON.parse(mappingJsonRaw) as Record<string, string>;
    } catch {
      return NextResponse.json({ error: "Invalid mapping JSON" }, { status: 400 });
    }
    const missing = REQUIRED_FIELDS.filter((f) => !mapping[f]);
    if (missing.length) {
      return NextResponse.json(
        { error: `missing required mappings: ${missing.join(", ")}` },
        { status: 400 },
      );
    }

    await prisma.importMappingConfig.upsert({
      where: { tenantId_importType: { tenantId: user.tenantId, importType: "STUDENTS_SNAPSHOT" } },
      create: { tenantId: user.tenantId, importType: "STUDENTS_SNAPSHOT", mappingJson: mapping },
      update: { mappingJson: mapping },
    });

    const mappingWithMeta = { ...mapping, _snapshotDate: snapshotDateRaw };

    const importJob = await prisma.importJob.create({
      data: {
        tenantId: user.tenantId,
        type: "STUDENTS_SNAPSHOT",
        status: "PENDING",
        uploadedBy: user.id,
        fileName: file.name,
        rowCount: 0,
        mappingJson: mappingWithMeta as object,
      },
    });

    const text = await file.text();
    const storagePath = await saveImportFile(user.tenantId, importJob.id, text);
    await prisma.importJob.update({
      where: { id: importJob.id },
      data: { storagePath },
    });

    void processImportJob(importJob.id);

    return NextResponse.json(
      {
        importJobId: importJob.id,
        status: "PENDING",
        message: "Import queued for processing",
      },
      { status: 202 },
    );
  } catch (err) {
    return apiErrorResponse(err);
  }
}
