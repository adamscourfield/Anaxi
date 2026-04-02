import { logger } from "@/lib/logger";

export async function sendOnCallNotification(
  _tenantId: string,
  request: {
    id: string;
    requestType: string;
    status: string;
    isEmergency?: boolean;
    student?: { fullName?: string } | null;
  },
  type: "created" | "acknowledged" | "resolved"
) {
  const studentName = request.student?.fullName ?? "Unknown";
  logger.info(`[OnCall] ${type.toUpperCase()}`, {
    requestId: request.id,
    student: studentName,
    requestType: request.requestType,
    status: request.status,
    isEmergency: Boolean(request.isEmergency),
  });
  // Future: send email via SendGrid or similar
}
