import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/apiErrors";
import { requireFeature } from "@/lib/guards";
import { hasPermission } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import type { SnapshotMapping } from "@/modules/students/snapshot-import";
import { computeHeaderSignature } from "@/modules/students/snapshot-fields";
import { saveImportFile } from "@/lib/importStorage";
import { processImportJob } from "@/modules/import/processPendingJobs";

export async function POST(req: Request) {
  try {
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

    const importJob = await prisma.importJob.create({
      data: {
        tenantId: user.tenantId,
        type: "STUDENT_SNAPSHOT",
        status: "PENDING",
        uploadedBy: user.id,
        fileName: file.name,
        rowCount: 0,
        mappingJson: mapping as object,
        startedAt: new Date(),
      },
    });

    const storagePath = await saveImportFile(user.tenantId, importJob.id, text);
    await prisma.importJob.update({
      where: { id: importJob.id },
      data: { storagePath },
    });

    if (saveMapping) {
      await prisma.tenantImportMapping.create({
        data: {
          tenantId: user.tenantId,
          type: "STUDENT_SNAPSHOT",
          name: mappingName,
          mappingJson: mapping as object,
          fixedCountScope: mapping.fixedCountScope ?? null,
          headerSignature,
          createdByUserId: user.id,
        },
      });
    }

    void processImportJob(importJob.id);

    logger.info("import.snapshot.queued", {
      tenantId: user.tenantId,
      importJobId: importJob.id,
    });

    return NextResponse.json(
      {
        importJobId: importJob.id,
        status: "PENDING",
        message: "Import queued for processing",
      },
      { status: 202 },
    );
  } catch (err) {
    return apiErrorResponse(err, "Import failed");
  }
}
