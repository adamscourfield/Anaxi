export interface CreateMeetingInput {
  title: string;
  type: "LINE_MANAGEMENT" | "DEPARTMENT" | "PASTORAL" | "SEN" | "OTHER";
  startDateTime: Date;
  endDateTime: Date;
  location?: string;
  notes?: string;
  attendeeIds: string[];
  status?: "PENDING" | "CONFIRMED" | "CANCELLED";
  startedAt?: Date | null;
}

export interface UpdateMeetingInput {
  title?: string;
  type?: "LINE_MANAGEMENT" | "DEPARTMENT" | "PASTORAL" | "SEN" | "OTHER";
  startDateTime?: Date;
  endDateTime?: Date;
  location?: string;
  notes?: string;
  attendeeIds?: string[];
  status?: "PENDING" | "CONFIRMED" | "CANCELLED";
  startedAt?: Date | null;
}

export interface MeetingAttendeeDetail {
  id: string;
  userId: string;
  user: { id: string; fullName: string; email: string };
}

export interface MeetingDetail {
  id: string;
  tenantId: string;
  title: string;
  type: string;
  status: string;
  startDateTime: Date;
  endDateTime: Date;
  startedAt?: Date | null;
  location?: string | null;
  notes?: string | null;
  createdByUserId: string;
  createdBy: { id: string; fullName: string; email: string };
  attendees: MeetingAttendeeDetail[];
  createdAt: Date;
  updatedAt: Date;
}

export interface MeetingWithAttendees extends MeetingDetail {
  _count?: { actions: number };
}

export const MEETING_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  CANCELLED: "Cancelled",
};

export const MEETING_TYPE_LABELS: Record<string, string> = {
  LINE_MANAGEMENT: "Line Management",
  DEPARTMENT: "Department",
  PASTORAL: "Pastoral",
  SEN: "SEN",
  OTHER: "Other",
};
