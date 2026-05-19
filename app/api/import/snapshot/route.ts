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
import { runSnapshotImport, type RunSnapshotImportResult } from "@/modules/students/runSnapshotImport";

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

    const importJob = await (prisma as any).importJob.create({
      data: {
        tenantId: user.tenantId,
        type: "STUDENT_SNAPSHOT",
        status: "RUNNING",
        uploadedBy: user.id,
        fileName: file.name,
        rowCount: 0,
        mappingJson: mapping as any,
        startedAt: new Date(),
      },
    });

    const storagePath = await saveImportFile(user.tenantId, importJob.id, text);
    await (prisma as any).importJob.update({
      where: { id: importJob.id },
      data: { storagePath },
    });

    let rowsProcessed = 0;
    let rowsFailed = 0;
    let errorReportJson: RunSnapshotImportResult["errorReportJson"];

    try {
      const result = await runSnapshotImport({
        tenantId: user.tenantId,
        importJobId: importJob.id,
        csvText: text,
        mapping,
      });
      rowsProcessed = result.rowsProcessed;
      rowsFailed = result.rowsFailed;
      errorReportJson = result.errorReportJson;
    } catch (err) {
      await (prisma as any).importJob.update({
        where: { id: importJob.id },
        data: {
          status: "FAILED",
          errorSummary: String(err instanceof Error ? err.message : err),
          finishedAt: new Date(),
        },
      });
      throw err;
    }

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
  } catch (err) {
    return apiErrorResponse(err, "Import failed");
  }
}
