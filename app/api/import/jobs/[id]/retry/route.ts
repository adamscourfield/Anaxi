import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/apiErrors";
import { requireFeature } from "@/lib/guards";
import { hasPermission } from "@/lib/rbac";
import { readImportFile, saveImportFile } from "@/lib/importStorage";
import { prisma } from "@/lib/prisma";
import { runSnapshotImport } from "@/modules/students/runSnapshotImport";
import type { SnapshotMapping } from "@/modules/students/snapshot-import";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const user = await getSessionUserOrThrow();
    await requireFeature(user.tenantId, "STUDENTS_IMPORT");
    if (!hasPermission(user.role, "import:write")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const original = await (prisma as any).importJob.findFirst({
      where: { id: resolvedParams.id, tenantId: user.tenantId },
    });
    if (!original) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (original.status !== "FAILED") {
      return NextResponse.json({ error: "Only failed jobs can be retried" }, { status: 400 });
    }
    if (!original.storagePath) {
      return NextResponse.json(
        { error: "This job has no stored file. Please upload the CSV again from the import page." },
        { status: 400 },
      );
    }
    if (!original.mappingJson) {
      return NextResponse.json(
        { error: "This job has no saved column mapping. Please run a new import from the import page." },
        { status: 400 },
      );
    }

    let csvText: string;
    try {
      csvText = await readImportFile(original.storagePath);
    } catch {
      return NextResponse.json(
        { error: "Stored import file is missing. Please upload the CSV again." },
        { status: 410 },
      );
    }

    const newJob = await (prisma as any).importJob.create({
      data: {
        tenantId: user.tenantId,
        type: original.type,
        status: "RUNNING",
        uploadedBy: user.id,
        fileName: original.fileName,
        mappingJson: original.mappingJson,
        rowCount: 0,
        startedAt: new Date(),
      },
    });

    const storagePath = await saveImportFile(user.tenantId, newJob.id, csvText);
    await (prisma as any).importJob.update({
      where: { id: newJob.id },
      data: { storagePath },
    });

    const mapping = original.mappingJson as SnapshotMapping;
    const { rowsProcessed, rowsFailed, errorReportJson } = await runSnapshotImport({
      tenantId: user.tenantId,
      importJobId: newJob.id,
      csvText,
      mapping,
    });

    return NextResponse.json({
      jobId: newJob.id,
      status: rowsFailed === 0 ? "SUCCESS" : "FAILED",
      rowsProcessed,
      rowsFailed,
      errorReportJson,
      fileName: original.fileName,
    });
  } catch (err) {
    return apiErrorResponse(err, "Retry failed");
  }
}
