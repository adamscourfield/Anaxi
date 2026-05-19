import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { hasPermission } from "@/lib/rbac";
import { readImportFile, saveImportFile } from "@/lib/importStorage";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "STUDENTS_IMPORT");
  if (!hasPermission(user.role, "import:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const original = await (prisma as any).importJob.findFirst({
    where: { id: params.id, tenantId: user.tenantId },
  });
  if (!original) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (original.status !== "FAILED") {
    return NextResponse.json({ error: "Only failed jobs can be retried" }, { status: 400 });
  }
  if (!original.storagePath) {
    return NextResponse.json(
      {
        error:
          "This job has no stored file. Please upload the CSV again from the import page.",
      },
      { status: 400 }
    );
  }

  let csvText: string;
  try {
    csvText = await readImportFile(original.storagePath);
  } catch {
    return NextResponse.json(
      { error: "Stored import file is missing. Please upload the CSV again." },
      { status: 410 }
    );
  }

  return NextResponse.json(
    {
      error:
        "Automatic retry is not available because import files are not stored. Please re-upload your CSV file.",
    },
  });

  const storagePath = await saveImportFile(user.tenantId, newJob.id, csvText);
  await (prisma as any).importJob.update({
    where: { id: newJob.id },
    data: { storagePath },
  });

  return NextResponse.json({
    jobId: newJob.id,
    status: newJob.status,
    message:
      "A new import job was created with your saved file. Open Student Import and submit the file again, or use the snapshot import flow with the same mapping.",
    fileName: original.fileName,
  });
}
