import type { UserRole } from "@/lib/types";

export const OBSERVATION_HISTORY_PHASE_FILTERS = new Set([
  "INSTRUCTION",
  "GUIDED_PRACTICE",
  "INDEPENDENT_PRACTICE",
  "UNKNOWN",
  "THRESHOLD",
  "TRANSITION_START",
  "BOOKS",
]);

export type ObservationHistoryWhereContext = {
  tenantId: string;
  userRole: UserRole;
  userId: string;
  teacherId: string;
  subject: string;
  yearGroup: string;
  observerId: string;
  from: string;
  to: string;
  phaseFilter: string;
  signalKeyFilter: string;
  useWindow: boolean;
  windowStart: Date | null;
  hodVisibleUserIds: Set<string>;
  coacheeUserIds: string[];
};

/**
 * Prisma `where` for observation history list + analytics (same scope as the table).
 */
export function buildObservationHistoryWhere(ctx: ObservationHistoryWhereContext): {
  where: Record<string, unknown>;
  allowedTeacherIds: Set<string> | null;
} {
  const {
    tenantId,
    userRole,
    userId,
    teacherId,
    subject,
    yearGroup,
    observerId,
    from,
    to,
    phaseFilter,
    signalKeyFilter,
    useWindow,
    windowStart,
    hodVisibleUserIds,
    coacheeUserIds,
  } = ctx;

  const where: Record<string, unknown> = {
    tenantId,
    ...(subject ? { subject } : {}),
    ...(yearGroup ? { yearGroup } : {}),
    ...(observerId ? { observerId } : {}),
    ...(phaseFilter ? { phase: phaseFilter } : {}),
    ...(signalKeyFilter
      ? {
          signals: {
            some: { signalKey: signalKeyFilter },
          },
        }
      : {}),
    ...((from || to || useWindow)
      ? {
          observedAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
            ...(useWindow && windowStart ? { gte: windowStart } : {}),
          },
        }
      : {}),
  };

  let allowedTeacherIds: Set<string> | null = null;

  if (userRole === "TEACHER" || userRole === "SUPPORT") {
    where.observedTeacherId = userId;
    allowedTeacherIds = new Set([userId]);
  } else if (userRole === "ADMIN" || userRole === "SLT" || userRole === "SUPER_ADMIN") {
    if (teacherId) where.observedTeacherId = teacherId;
  } else {
    allowedTeacherIds = new Set<string>([...hodVisibleUserIds, ...coacheeUserIds]);
    if (teacherId) {
      where.observedTeacherId = allowedTeacherIds.has(teacherId) ? teacherId : "__NO_MATCH__";
    } else {
      where.observedTeacherId = { in: Array.from(allowedTeacherIds) };
    }
  }

  return { where, allowedTeacherIds };
}
