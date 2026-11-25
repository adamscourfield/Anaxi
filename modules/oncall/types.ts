import { startOfDayInZone } from "./time";

export interface OnCallRequestInput {
  studentId: string;
  requestType: "BEHAVIOUR" | "FIRST_AID";
  location: string;
  behaviourReasonCategory?: string;
  notes?: string;
  isEmergency?: boolean;
}

export interface AcknowledgeOnCallInput {
  notes?: string;
}

export interface ResolveOnCallInput {
  notes?: string;
}

export interface OnCallRequestDetail {
  id: string;
  tenantId: string;
  requesterUserId: string;
  requester: { id: string; fullName: string; email: string };
  studentId: string;
  student: { id: string; fullName: string; upn: string; yearGroup?: string | null };
  requestType: "BEHAVIOUR" | "FIRST_AID";
  isEmergency: boolean;
  location: string;
  behaviourReasonCategory?: string | null;
  notes?: string | null;
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "CANCELLED";
  responderUserId?: string | null;
  responder?: { id: string; fullName: string } | null;
  createdAt: Date;
  acknowledgedAt?: Date | null;
  resolvedAt?: Date | null;
  updatedAt: Date;
}

export const REQUEST_TYPE_LABELS: Record<"BEHAVIOUR" | "FIRST_AID", string> = {
  BEHAVIOUR: "Behaviour",
  FIRST_AID: "First aid",
};

export const STATUS_LABELS: Record<"OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "CANCELLED", string> = {
  OPEN: "Open",
  ACKNOWLEDGED: "Acknowledged",
  RESOLVED: "Resolved",
  CANCELLED: "Cancelled",
};

export const REASON_CATEGORIES = [
  "Physical aggression",
  "Verbal abuse",
  "Disruption",
  "Safeguarding concern",
  "Self-harm risk",
  "Property damage",
  "Refusal",
  "Other",
] as const;

export const LOCATION_SUGGESTIONS = [
  "Hallway",
  "Reception",
  "Office",
  "Canteen",
  "Playground",
  "Sports Hall",
  "Library",
  "Toilets",
] as const;

export type ResolvedHistoryRange = "today" | "7d" | "30d" | "all";

export const RESOLVED_HISTORY_RANGE_LABELS: Record<ResolvedHistoryRange, string> = {
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  all: "All time",
};

export function parseResolvedHistoryRange(value: string | undefined): ResolvedHistoryRange {
  if (value === "7d" || value === "30d" || value === "all") return value;
  return "today";
}

/** Start-of-window boundary for a resolved-history range, or null for "all time" (no lower bound). */
export function resolvedHistoryRangeStart(range: ResolvedHistoryRange, now: Date): Date | null {
  if (range === "today") return startOfDayInZone(now);
  const start = new Date(now);
  if (range === "7d") {
    start.setDate(start.getDate() - 7);
    return start;
  }
  if (range === "30d") {
    start.setDate(start.getDate() - 30);
    return start;
  }
  return null;
}
