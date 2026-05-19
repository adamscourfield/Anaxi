import type { ImportJobStatus } from "@prisma/client";

/** Terminal statuses for import jobs (COMPLETED kept for legacy rows). */
export const FINISHED_IMPORT_STATUSES: ImportJobStatus[] = ["SUCCESS", "FAILED", "COMPLETED"];

export function isImportJobFinished(status: string): boolean {
  return FINISHED_IMPORT_STATUSES.includes(status as ImportJobStatus);
}

export function successImportStatus(): ImportJobStatus {
  return "SUCCESS";
}

export function failedImportStatus(): ImportJobStatus {
  return "FAILED";
}
