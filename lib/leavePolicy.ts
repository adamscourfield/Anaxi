import { businessDaysBetween, dateRangesOverlap } from "@/lib/leaveDates";
import { approvedStatusFilter, isPendingStatus } from "@/lib/leaveStatus";

export const LEAVE_MEDICAL_MIN_BUSINESS_DAYS = 3;

export type LeavePolicyViolation =
  | "INVALID_DATES"
  | "NO_WORKING_DAYS"
  | "MEDICAL_REQUIRED"
  | "OVERLAPPING_LEAVE";

export type LeavePolicyInput = {
  startDate: Date;
  endDate: Date;
  medicalEvidenceUrl: string | null;
  /** Whether the selected reason is one that requires medical evidence (e.g. Sick Leave). */
  reasonRequiresMedicalEvidence: boolean;
  existingRequests: Array<{
    id: string;
    startDate: Date;
    endDate: Date;
    status: string;
  }>;
  excludeRequestId?: string;
};

export function validateLeavePolicy(input: LeavePolicyInput): LeavePolicyViolation | null {
  const { startDate, endDate, medicalEvidenceUrl, reasonRequiresMedicalEvidence, existingRequests, excludeRequestId } = input;

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < startDate) {
    return "INVALID_DATES";
  }

  const businessDays = businessDaysBetween(startDate, endDate);
  if (businessDays === 0) return "NO_WORKING_DAYS";

  if (reasonRequiresMedicalEvidence && businessDays >= LEAVE_MEDICAL_MIN_BUSINESS_DAYS && !medicalEvidenceUrl?.trim()) {
    return "MEDICAL_REQUIRED";
  }

  const approvedSet = new Set(approvedStatusFilter());
  for (const req of existingRequests) {
    if (excludeRequestId && req.id === excludeRequestId) continue;
    if (isPendingStatus(req.status) || approvedSet.has(req.status)) {
      if (dateRangesOverlap(startDate, endDate, req.startDate, req.endDate)) {
        return "OVERLAPPING_LEAVE";
      }
    }
  }

  return null;
}

export function leavePolicyMessageForCode(code: string): string {
  if (code === "INVALID_REASON") return "Choose a type of leave.";
  if (code === "INVALID_REQUEST") return "Check the dates and try again.";
  if (code === "INVALID_EVIDENCE") return "The evidence file couldn't be read. Upload a PDF or image under the size limit.";
  if (code === "INVALID_DATES" || code === "NO_WORKING_DAYS" || code === "MEDICAL_REQUIRED" || code === "OVERLAPPING_LEAVE") {
    return leavePolicyErrorMessage(code as LeavePolicyViolation);
  }
  return "Unable to submit this request.";
}

export function leavePolicyErrorMessage(code: LeavePolicyViolation): string {
  switch (code) {
    case "INVALID_DATES":
      return "The end must be on or after the start.";
    case "NO_WORKING_DAYS":
      return "These dates fall on a weekend, so there's no leave to request.";
    case "MEDICAL_REQUIRED":
      return `Medical evidence is required for medical absences of ${LEAVE_MEDICAL_MIN_BUSINESS_DAYS} or more consecutive working days.`;
    case "OVERLAPPING_LEAVE":
      return "These dates overlap leave you've already requested or had approved.";
    default:
      return "This leave request could not be submitted.";
  }
}
