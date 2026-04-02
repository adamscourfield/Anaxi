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
  FIRST_AID: "First Aid",
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
