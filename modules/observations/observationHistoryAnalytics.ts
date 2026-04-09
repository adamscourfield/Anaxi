import type { UserRole } from "@/lib/types";

export type RoleCountRow = { role: string; label: string; count: number };

export type CoachingPairWeeklyRow = {
  coachId: string;
  coacheeId: string;
  coachName: string;
  coacheeName: string;
  observationCount: number;
  weeksWithObservation: number;
  weekLabels: string[];
  weekHit: boolean[];
};

export type TimelineWeekRow = { weekKey: string; label: string; count: number };

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** Monday 00:00 local */
function startOfWeekMonday(d: Date): Date {
  const x = startOfDay(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

function weekKey(d: Date): string {
  const w = startOfWeekMonday(d);
  const y = w.getFullYear();
  const m = String(w.getMonth() + 1).padStart(2, "0");
  const day = String(w.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatWeekLabel(weekStart: Date): string {
  return weekStart.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function enumerateWeeks(start: Date, end: Date): Date[] {
  const out: Date[] = [];
  let cur = startOfWeekMonday(start);
  const last = startOfWeekMonday(end);
  while (cur <= last) {
    out.push(new Date(cur));
    cur = new Date(cur);
    cur.setDate(cur.getDate() + 7);
  }
  return out;
}

const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: "Super admin",
  ADMIN: "Admin",
  SLT: "SLT",
  LEADER: "Leader",
  HOD: "Head of dept",
  TEACHER: "Teacher",
  HR: "HR",
  ON_CALL: "On-call",
};

export function resolveObservationAnalysisRange(params: {
  from: string;
  to: string;
  useWindow: boolean;
  windowStart: Date | null;
}): { start: Date; end: Date; label: string } {
  const { from, to, useWindow, windowStart } = params;
  let end = to ? endOfDay(new Date(to)) : new Date();
  let start: Date | null = null;

  if (from) start = startOfDay(new Date(from));
  if (useWindow && windowStart) {
    start = new Date(windowStart);
    end = new Date();
  } else if (from && !to) {
    end = new Date();
  }

  if (!start) {
    start = new Date(end);
    start.setDate(start.getDate() - 26 * 7);
    start = startOfWeekMonday(start);
  }

  if (start > end) {
    const t = start;
    start = end;
    end = t;
  }

  const fmt = (d: Date) =>
    d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  let label = `${fmt(start)} – ${fmt(end)}`;
  if (!from && !to && !useWindow) {
    label = `Last ~26 weeks (${label})`;
  }

  return { start, end, label };
}

export type ObsAnalyticsRow = {
  observedTeacherId: string;
  observerId: string;
  observedAt: Date;
  observerRole: UserRole;
};

export function computeObservationHistoryAnalytics(input: {
  observations: ObsAnalyticsRow[];
  range: { start: Date; end: Date };
  coachAssignments: {
    coachUserId: string;
    coacheeUserId: string;
    coachName: string;
    coacheeName: string;
  }[];
  showCoachingSection: boolean;
}): {
  roleCounts: RoleCountRow[];
  pairWeekly: CoachingPairWeeklyRow[];
  timelineWeeks: TimelineWeekRow[];
} {
  const { observations, range, coachAssignments, showCoachingSection } = input;

  const inRange = (d: Date) => d >= range.start && d <= range.end;

  const obsInRange = observations.filter((o) => inRange(new Date(o.observedAt)));

  const byRole = new Map<string, number>();
  for (const o of observations) {
    const role = o.observerRole;
    byRole.set(role, (byRole.get(role) ?? 0) + 1);
  }

  const roleCounts: RoleCountRow[] = Array.from(byRole.entries())
    .map(([role, count]) => ({
      role,
      label: ROLE_LABELS[role as UserRole] ?? role.replaceAll("_", " "),
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const weekStarts = enumerateWeeks(range.start, range.end);
  const weekKeys = weekStarts.map((w) => weekKey(w));
  const weekLabels = weekStarts.map((w) => formatWeekLabel(w));

  const timelineMap = new Map<string, number>();
  for (const k of weekKeys) timelineMap.set(k, 0);
  for (const o of obsInRange) {
    const k = weekKey(new Date(o.observedAt));
    if (timelineMap.has(k)) timelineMap.set(k, (timelineMap.get(k) ?? 0) + 1);
  }
  const timelineWeeks: TimelineWeekRow[] = weekStarts.map((w, i) => ({
    weekKey: weekKeys[i],
    label: weekLabels[i],
    count: timelineMap.get(weekKeys[i]) ?? 0,
  }));

  const pairWeekly: CoachingPairWeeklyRow[] = [];
  if (showCoachingSection && coachAssignments.length > 0) {
    for (const a of coachAssignments) {
      const pairObs = obsInRange.filter(
        (o) => o.observerId === a.coachUserId && o.observedTeacherId === a.coacheeUserId,
      );
      const hitKeys = new Set(pairObs.map((o) => weekKey(new Date(o.observedAt))));
      const weekHit = weekKeys.map((k) => hitKeys.has(k));
      pairWeekly.push({
        coachId: a.coachUserId,
        coacheeId: a.coacheeUserId,
        coachName: a.coachName,
        coacheeName: a.coacheeName,
        observationCount: pairObs.length,
        weeksWithObservation: weekHit.filter(Boolean).length,
        weekLabels,
        weekHit,
      });
    }
  }

  return { roleCounts, pairWeekly, timelineWeeks };
}
