import fs from "fs/promises";
import path from "path";

const IMPORT_ROOT = process.env.IMPORT_STORAGE_DIR || path.join(process.cwd(), "storage", "imports");

export function importJobFilePath(tenantId: string, jobId: string): string {
  return path.join(IMPORT_ROOT, tenantId, `${jobId}.csv`);
}

export async function saveImportFile(tenantId: string, jobId: string, content: string | Buffer): Promise<string> {
  const filePath = importJobFilePath(tenantId, jobId);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content);
  return filePath;
}

export async function readImportFile(storagePath: string): Promise<string> {
  return fs.readFile(storagePath, "utf8");
}

export async function deleteImportFile(storagePath: string): Promise<void> {
  try {
    await fs.unlink(storagePath);
  } catch {
    // ignore missing files
  }
}
