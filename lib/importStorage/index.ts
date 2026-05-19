import * as local from "@/lib/importStorage/local";
import * as s3 from "@/lib/importStorage/s3";

export type ImportStorageBackend = "local" | "s3";

export function getImportStorageBackend(): ImportStorageBackend {
  const configured = process.env.IMPORT_STORAGE_BACKEND?.toLowerCase();
  if (configured === "s3") return "s3";
  if (configured === "local") return "local";
  return process.env.IMPORT_S3_BUCKET ? "s3" : "local";
}

function objectKey(tenantId: string, jobId: string): string {
  return `${tenantId}/${jobId}.csv`;
}

export async function saveImportFile(
  tenantId: string,
  jobId: string,
  content: string | Buffer,
): Promise<string> {
  if (getImportStorageBackend() === "s3") {
    return s3.s3Save(objectKey(tenantId, jobId), content);
  }
  return local.localSave(tenantId, jobId, content);
}

export async function readImportFile(storagePath: string): Promise<string> {
  if (storagePath.startsWith("s3://")) {
    return s3.s3Read(storagePath);
  }
  return local.localRead(storagePath);
}

export async function deleteImportFile(storagePath: string): Promise<void> {
  if (storagePath.startsWith("s3://")) {
    await s3.s3Delete(storagePath);
    return;
  }
  await local.localDelete(storagePath);
}

/** @deprecated Use saveImportFile — kept for callers using path helpers */
export function importJobFilePath(tenantId: string, jobId: string): string {
  return local.localImportPath(tenantId, jobId);
}
