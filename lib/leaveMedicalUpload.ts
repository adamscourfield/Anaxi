import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/jpg"]);
const ALLOWED_EXT = new Set([".pdf", ".jpg", ".jpeg", ".png"]);

export function medicalEvidencePublicPath(fileToken: string): string {
  return `/api/leave/evidence/${fileToken}`;
}

export async function saveMedicalEvidenceFile(
  tenantId: string,
  file: File,
): Promise<{ url: string; fileToken: string }> {
  if (!file || file.size <= 0) {
    throw new Error("EMPTY_FILE");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("FILE_TOO_LARGE");
  }

  const ext = path.extname(file.name || "").toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    throw new Error("INVALID_FILE_TYPE");
  }
  const mime = (file.type || "").toLowerCase();
  if (mime && !ALLOWED_TYPES.has(mime)) {
    throw new Error("INVALID_FILE_TYPE");
  }

  const fileToken = `${tenantId}_${randomBytes(16).toString("hex")}${ext}`;
  const dir = path.join(process.cwd(), "uploads", "leave", tenantId);
  await mkdir(dir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, fileToken), buffer);

  return { fileToken, url: medicalEvidencePublicPath(fileToken) };
}

export function medicalEvidenceDiskPath(tenantId: string, fileToken: string): string | null {
  if (!fileToken.startsWith(`${tenantId}_`)) return null;
  const base = path.basename(fileToken);
  if (base !== fileToken || base.includes("..")) return null;
  return path.join(process.cwd(), "uploads", "leave", tenantId, base);
}
