import fs from "fs/promises";
import path from "path";

const IMPORT_ROOT =
  process.env.IMPORT_STORAGE_DIR || path.join(process.cwd(), "storage", "imports");

export function localImportPath(tenantId: string, jobId: string): string {
  return path.join(IMPORT_ROOT, tenantId, `${jobId}.csv`);
}

export async function localSave(
  tenantId: string,
  jobId: string,
  content: string | Buffer,
): Promise<string> {
  const filePath = localImportPath(tenantId, jobId);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content);
  return filePath;
}

export async function localRead(storagePath: string): Promise<string> {
  return fs.readFile(storagePath, "utf8");
}

export async function localDelete(storagePath: string): Promise<void> {
  try {
    await fs.unlink(storagePath);
  } catch {
    // ignore missing files
  }
}
