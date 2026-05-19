/**
 * Canonical LOA request status values and UI helpers.
 */

export const LOA_STATUSES = [
  "PENDING",
  "APPROVED_WITH_PAY",
  "APPROVED_WITHOUT_PAY",
  "DENIED",
  "CANCELLED",
] as const;

export type LoaRequestStatus = (typeof LOA_STATUSES)[number];

const LEGACY_APPROVED = "APPROVED";

export function isLoaRequestStatus(value: string): value is LoaRequestStatus {
  return (LOA_STATUSES as readonly string[]).includes(value);
}

/** Normalise legacy `APPROVED` rows for reads. */
export function normalizeLoaStatus(status: string): LoaRequestStatus | string {
  if (status === LEGACY_APPROVED) return "APPROVED_WITH_PAY";
  return status;
}

export function isPendingStatus(status: string): boolean {
  return normalizeLoaStatus(status) === "PENDING";
}

export function isCancelledStatus(status: string): boolean {
  return normalizeLoaStatus(status) === "CANCELLED";
}

export function isDeniedStatus(status: string): boolean {
  return normalizeLoaStatus(status) === "DENIED";
}

export function isApprovedStatus(status: string): boolean {
  const s = normalizeLoaStatus(status);
  return s === "APPROVED_WITH_PAY" || s === "APPROVED_WITHOUT_PAY";
}

export function isResolvedStatus(status: string): boolean {
  return isApprovedStatus(status) || isDeniedStatus(status) || isCancelledStatus(status);
}

export type LoaStatusUiBucket = "PENDING" | "APPROVED" | "DENIED" | "CANCELLED";

export function loaStatusUiBucket(status: string): LoaStatusUiBucket {
  const s = normalizeLoaStatus(status);
  if (s === "PENDING") return "PENDING";
  if (isApprovedStatus(s)) return "APPROVED";
  if (s === "DENIED") return "DENIED";
  if (s === "CANCELLED") return "CANCELLED";
  return "PENDING";
}

export function loaStatusLabel(status: string): string {
  const s = normalizeLoaStatus(status);
  switch (s) {
    case "PENDING":
      return "Pending approval";
    case "APPROVED_WITH_PAY":
      return "Approved with pay";
    case "APPROVED_WITHOUT_PAY":
      return "Approved without pay";
    case "DENIED":
      return "Denied";
    case "CANCELLED":
      return "Cancelled";
    default:
      return String(s);
  }
}

export const LOA_DECISION_TYPES = ["APPROVED_WITH_PAY", "APPROVED_WITHOUT_PAY", "DENIED"] as const;
export type LoaDecisionType = (typeof LOA_DECISION_TYPES)[number];

export function isLoaDecisionType(value: string): value is LoaDecisionType {
  return (LOA_DECISION_TYPES as readonly string[]).includes(value);
}

/** Prisma `in` filter for approved leave (includes legacy). */
export function approvedStatusFilter(): string[] {
  return ["APPROVED", "APPROVED_WITH_PAY", "APPROVED_WITHOUT_PAY"];
}
