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
  /** Teachers and support staff: "of" = their own lessons, "by" = ones they observed, "" = both. */
  scope?: ObservationHistoryScope;
};

export type ObservationHistoryScope = "" | "of" | "by";

export function parseObservationHistoryScope(raw: string): ObservationHistoryScope {
  return raw === "of" || raw === "by" ? raw : "";
}

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
    scope = "",
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

  // Everyone can always see the observations they recorded themselves, whoever was observed.
  if (userRole === "TEACHER" || userRole === "SUPPORT") {
    allowedTeacherIds = new Set([userId]);
    if (teacherId && teacherId !== userId) {
      // A colleague: only the observations of them that this person recorded.
      where.observedTeacherId = teacherId;
      where.observerId = userId;
    } else if (scope === "of" || teacherId === userId) where.observedTeacherId = userId;
    else if (scope === "by") where.observerId = userId;
    else where.OR = [{ observedTeacherId: userId }, { observerId: userId }];
  } else if (userRole === "ADMIN" || userRole === "SLT" || userRole === "SUPER_ADMIN") {
    if (teacherId) where.observedTeacherId = teacherId;
  } else {
    allowedTeacherIds = new Set<string>([...hodVisibleUserIds, ...coacheeUserIds, userId]);
    if (teacherId) {
      where.observedTeacherId = teacherId;
      // Outside their team, only the ones they recorded.
      if (!allowedTeacherIds.has(teacherId)) where.observerId = userId;
    } else {
      where.OR = [{ observedTeacherId: { in: Array.from(allowedTeacherIds) } }, { observerId: userId }];
    }
  }

  return { where, allowedTeacherIds };
}
