const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function avatarUrlFor(userId: string, updatedAt: Date | string | null | undefined): string | null {
  if (!updatedAt) return null;
  const v = new Date(updatedAt).getTime();
  return `/api/users/${userId}/avatar?v=${v}`;
}

export async function readAvatarFile(file: File): Promise<{ bytes: Buffer; mimeType: string }> {
  if (!file || file.size <= 0) throw new Error("EMPTY_FILE");
  if (file.size > MAX_BYTES) throw new Error("FILE_TOO_LARGE");
  const mime = (file.type || "").toLowerCase();
  if (!ALLOWED_TYPES.has(mime)) throw new Error("INVALID_FILE_TYPE");
  const bytes = Buffer.from(await file.arrayBuffer());
  return { bytes, mimeType: mime };
}

export function avatarUploadErrorMessage(code: string): string {
  switch (code) {
    case "EMPTY_FILE":
      return "Please choose an image file.";
    case "FILE_TOO_LARGE":
      return "Image must be under 2MB.";
    case "INVALID_FILE_TYPE":
      return "Only JPEG, PNG, or WebP images are supported.";
    default:
      return "Something went wrong. Please try again.";
  }
}
