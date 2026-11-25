import type { PillVariant } from "@/components/ui/status-pill";

/** One label for where a meeting is up to, used on the list and the meeting page. */
export function meetingState(m: {
  status: string;
  startedAt?: Date | string | null;
  endedAt?: Date | string | null;
  startDateTime: Date | string;
}, todayStart?: Date): { label: string; variant: PillVariant } {
  if (m.status === "CANCELLED") return { label: "Cancelled", variant: "neutral" };
  if (m.endedAt) return { label: "Ended", variant: "success" };
  if (m.startedAt) return { label: "In progress", variant: "info" };
  if (todayStart && new Date(m.startDateTime) < todayStart) return { label: "Not held", variant: "neutral" };
  if (m.status === "PENDING") return { label: "Provisional", variant: "warning" };
  return { label: "Scheduled", variant: "neutral" };
}
