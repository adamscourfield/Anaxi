/**
 * Student Risk Index (SRI) — Phase 1C
 *
 * Computes per-student pastoral risk scores from behaviour and attendance
 * snapshot data. This is a diagnostic support-prioritisation tool, not a
 * grading or judgement system.
 *
 * Scores are bucket-based (not continuous), transparent, and confidence-labelled.
 */

import { prisma } from "@/lib/prisma";

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_WINDOW_DAYS = 21;

// ─── Types ────────────────────────────────────────────────────────────────────

export type RiskBand = "STABLE" | "WATCH" | "PRIORITY" | "URGENT";
export type Confidence = "HIGH" | "LOW";

export type MetricDriver = {
  metric: string;
  label: string;
  direction: "up" | "down";
};

export type SnapshotSummary = {
  snapshotDate: Date;
  attendancePct: number;
  onCallsCount: number;
  detentionsCount: number;
  latenessCount: number;
  internalExclusionsCount: number;
  suspensionsCount: number;
  positivePointsTotal: number;
};

export type StudentRiskRow = {
  studentId: string;
  studentName: string;
  /** Resolved by the list page, rather than exposing image bytes to risk calculations. */
  avatarUrl?: string | null;
  yearGroup: string | null;
  status: "ACTIVE" | "ARCHIVED";
  sendFlag: boolean;
  ppFlag: boolean;
  band: RiskBand;
  riskScore: number;
  confidence: Confidence;
  lastSnapshotDate: Date | null;
  drivers: MetricDriver[];
  // Current absolute values
  attendancePct: number | null;
  detentionsCount: number | null;
  onCallsCount: number | null;
  detentionsDelta: number | null;
  onCallsDelta: number | null;
  latenessDelta: number | null;
  suspensionsDelta: number | null;
  internalExclusionsDelta: number | null;
  attendanceDelta: number | null;
  positivePointsTotal: number | null;
  // Watchlist
  onWatchlist: boolean;
};

export type StudentRiskProfile = {
  studentId: string;
  studentName: string;
  yearGroup: string | null;
  sendFlag: boolean;
  ppFlag: boolean;
  band: RiskBand;
  riskScore: number;
  confidence: Confidence;
  lastSnapshotDate: Date | null;
  drivers: MetricDriver[];
  // Current absolute values
  currentSnapshot: SnapshotSummary | null;
  // The comparison point from the start of the window -- what the metrics looked
  // like `windowDays` ago, shown alongside currentSnapshot so a leader can read
  // "then vs now" directly instead of only an abstract delta.
  baselineSnapshot: SnapshotSummary | null;
  // Deltas
  attendanceDelta: number | null;
  onCallsDelta: number | null;
  detentionsDelta: number | null;
  latenessDelta: number | null;
  suspensionsDelta: number | null;
  internalExclusionsDelta: number | null;
  positivePointsDelta: number | null;
  // Recent trend (last 3 snapshots)
  recentSnapshots: SnapshotSummary[];
  // Watchlist
  onWatchlist: boolean;
  computedAt: Date;
};

// ─── Severity buckets ─────────────────────────────────────────────────────────

/** Attendance severity (delta = current - previous; negative = worsening) */
function attendanceSeverity(delta: number): number {
  if (delta >= -1.0) return 0;
  if (delta >= -3.0) return 1;
  if (delta >= -6.0) return 2;
  return 3;
}

/** On-call severity */
function onCallSeverity(delta: number): number {
  if (delta <= 0) return 0;
  if (delta === 1) return 2;
  return 3;
}

/** Detentions severity */
function detentionSeverity(delta: number): number {
  if (delta <= 0) return 0;
  if (delta <= 2) return 1;
  if (delta <= 5) return 2;
  return 3;
}

/** Suspensions severity */
function suspensionSeverity(delta: number): number {
  if (delta <= 0) return 0;
  return 3;
}

/** Internal exclusion severity */
function internalExclusionSeverity(delta: number): number {
  if (delta <= 0) return 0;
  if (delta === 1) return 2;
  return 3;
}

/** Lateness severity */
function latenessSeverity(delta: number): number {
  if (delta <= 0) return 0;
  if (delta <= 2) return 1;
  if (delta <= 5) return 2;
  return 3;
}

// ─── Risk band ────────────────────────────────────────────────────────────────

export function scoreToBand(score: number): RiskBand {
  if (score <= 2) return "STABLE";
  if (score <= 5) return "WATCH";
  if (score <= 8) return "PRIORITY";
  return "URGENT";
}

export const BAND_ORDER: Record<RiskBand, number> = {
  URGENT: 0,
  PRIORITY: 1,
  WATCH: 2,
  STABLE: 3,
};

// ─── Driver detection ─────────────────────────────────────────────────────────

function buildDrivers(
  attendanceDelta: number | null,
  onCallsDelta: number | null,
  detentionsDelta: number | null,
  latenessDelta: number | null,
  suspensionsDelta: number | null,
  internalExclusionsDelta: number | null
): MetricDriver[] {
  const drivers: MetricDriver[] = [];

  if (attendanceDelta !== null && attendanceSeverity(attendanceDelta) > 0) {
    drivers.push({ metric: "attendance", label: "Attendance ↓", direction: "down" });
  }
  if (onCallsDelta !== null && onCallSeverity(onCallsDelta) > 0) {
    drivers.push({ metric: "onCalls", label: "On calls ↑", direction: "up" });
  }
  if (suspensionsDelta !== null && suspensionSeverity(suspensionsDelta) > 0) {
    drivers.push({ metric: "suspensions", label: "Suspensions ↑", direction: "up" });
  }
  if (internalExclusionsDelta !== null && internalExclusionSeverity(internalExclusionsDelta) > 0) {
    drivers.push({ metric: "internalExclusions", label: "Exclusions ↑", direction: "up" });
  }
  if (detentionsDelta !== null && detentionSeverity(detentionsDelta) > 0) {
    drivers.push({ metric: "detentions", label: "Detentions ↑", direction: "up" });
  }
  if (latenessDelta !== null && latenessSeverity(latenessDelta) > 0) {
    drivers.push({ metric: "lateness", label: "Lateness ↑", direction: "up" });
  }

  return drivers;
}

// ─── Score computation ────────────────────────────────────────────────────────

export type SRIDeltas = {
  attendanceDelta: number | null;
  onCallsDelta: number | null;
  detentionsDelta: number | null;
  latenessDelta: number | null;
  suspensionsDelta: number | null;
  internalExclusionsDelta: number | null;
};

export function computeRiskScore(deltas: SRIDeltas): number {
  let score = 0;
  if (deltas.attendanceDelta !== null) score += attendanceSeverity(deltas.attendanceDelta);
  if (deltas.onCallsDelta !== null) score += onCallSeverity(deltas.onCallsDelta);
  if (deltas.detentionsDelta !== null) score += detentionSeverity(deltas.detentionsDelta);
  if (deltas.suspensionsDelta !== null) score += suspensionSeverity(deltas.suspensionsDelta);
  if (deltas.internalExclusionsDelta !== null) score += internalExclusionSeverity(deltas.internalExclusionsDelta);
  if (deltas.latenessDelta !== null) score += latenessSeverity(deltas.latenessDelta);
  return score;
}

// ─── Window helpers ───────────────────────────────────────────────────────────

function windowBounds(windowDays: number): {
  currentStart: Date;
  currentEnd: Date;
  prevStart: Date;
  prevEnd: Date;
} {
  const now = new Date();
  const currentEnd = now;
  const currentStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
  const prevEnd = currentStart;
  const prevStart = new Date(currentStart.getTime() - windowDays * 24 * 60 * 60 * 1000);
  return { currentStart, currentEnd, prevStart, prevEnd };
}

function toSnapshotSummary(snap: any): SnapshotSummary {
  return {
    snapshotDate: snap.snapshotDate,
    attendancePct: Number(snap.attendancePct),
    onCallsCount: snap.onCallsCount,
    detentionsCount: snap.detentionsCount,
    latenessCount: snap.latenessCount,
    internalExclusionsCount: snap.internalExclusionsCount,
    suspensionsCount: snap.suspensionsCount,
    positivePointsTotal: snap.positivePointsTotal ?? 0,
  };
}

function highestCumulative(snapshots: any[], field: "suspensionsCount"): number {
  return snapshots.reduce((highest, snapshot) => Math.max(highest, Number(snapshot[field] ?? 0)), 0);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export type StudentStatusFilter = "ACTIVE" | "ARCHIVED" | "ALL";

/**
 * Compute the Student Risk Index for a tenant's students.
 *
 * Archived students aren't risk-scored (they're no longer being tracked, so
 * deltas between snapshots are meaningless) -- when included, they're
 * returned as flat, unscored rows showing whatever their last known
 * snapshot said, purely for browsing/unarchiving purposes.
 */
export async function computeStudentRiskIndex(
  tenantId: string,
  windowDays: number = DEFAULT_WINDOW_DAYS,
  viewerUserId: string,
  statusFilter: StudentStatusFilter = "ACTIVE"
): Promise<{ rows: StudentRiskRow[]; computedAt: Date }> {
  const { currentStart, currentEnd, prevStart, prevEnd } = windowBounds(windowDays);

  const rows: StudentRiskRow[] = [];

  if (statusFilter === "ACTIVE" || statusFilter === "ALL") {
  const students = await (prisma as any).student.findMany({
    where: { tenantId, status: "ACTIVE" },
    include: {
      snapshots: {
        // Keep the latest academic-year snapshot visible while an Arbor catch-up is
        // still filling the selected comparison window. Movement remains blank until
        // there are snapshots inside both comparison periods.
        where: {
          OR: [
            { snapshotDate: { gte: prevStart, lte: currentEnd } },
            { countScope: "YEAR_TO_DATE" },
          ],
        },
        orderBy: { snapshotDate: "desc" },
      },
      watchlistEntries: {
        where: { tenantId, createdByUserId: viewerUserId },
      },
    },
  });

  for (const student of students as any[]) {
    const snapshots: any[] = student.snapshots ?? [];
    // Behaviour and attendance may be delivered in separate same-day snapshots.
    // Attendance must therefore only ever be read from a record with its own
    // possible-attendance total, never from a behaviour-only record with a zero.
    const attendanceSnapshots = snapshots.filter((s: any) => (s.attendancePossibleCount ?? 0) > 0);
    const attendanceCurrent = attendanceSnapshots[0] ?? null;
    const attendanceBaseline = attendanceCurrent
      ? attendanceSnapshots.find((s: any) => new Date(s.snapshotDate).getTime() <= new Date(attendanceCurrent.snapshotDate).getTime() - windowDays * 24 * 60 * 60 * 1000) ?? null
      : null;

    const currentWindowSnap = snapshots.find(
      (s: any) => s.snapshotDate >= currentStart && s.snapshotDate <= currentEnd
    );
    const latestYearToDateSnap = snapshots.find((s: any) => s.countScope === "YEAR_TO_DATE");
    const currentSnap = currentWindowSnap ?? latestYearToDateSnap;
    const prevSnap = snapshots.find(
      (s: any) => s.snapshotDate >= prevStart && s.snapshotDate < currentStart
    );

    // A student can be shown from the latest year-to-date Arbor snapshot before
    // the selected comparison window has caught up. In that case we do not infer a
    // movement trend from an older snapshot.
    if (!currentSnap) continue;

    const usablePrevious = currentWindowSnap ? prevSnap : null;
    const confidence: Confidence = usablePrevious ? "HIGH" : "LOW";

    const attendanceDelta = attendanceCurrent && attendanceBaseline
      ? Number(attendanceCurrent.attendancePct) - Number(attendanceBaseline.attendancePct)
      : null;
    const onCallsDelta = usablePrevious ? currentSnap.onCallsCount - usablePrevious.onCallsCount : null;
    const detentionsDelta = usablePrevious ? currentSnap.detentionsCount - usablePrevious.detentionsCount : null;
    const latenessDelta = usablePrevious ? currentSnap.latenessCount - usablePrevious.latenessCount : null;
    const currentSuspensions = highestCumulative(currentWindowSnap ? snapshots.filter((s: any) => s.snapshotDate >= currentStart && s.snapshotDate <= currentEnd) : [currentSnap], "suspensionsCount");
    const previousSuspensions = highestCumulative(usablePrevious ? snapshots.filter((s: any) => s.snapshotDate >= prevStart && s.snapshotDate < currentStart) : [], "suspensionsCount");
    const suspensionsDelta = usablePrevious
      ? currentSuspensions - previousSuspensions
      : null;
    const internalExclusionsDelta = usablePrevious
      ? currentSnap.internalExclusionsCount - usablePrevious.internalExclusionsCount
      : null;

    const riskScore = computeRiskScore({
      attendanceDelta,
      onCallsDelta,
      detentionsDelta,
      latenessDelta,
      suspensionsDelta,
      internalExclusionsDelta,
    });

    const band = scoreToBand(riskScore);

    const drivers = buildDrivers(
      attendanceDelta,
      onCallsDelta,
      detentionsDelta,
      latenessDelta,
      suspensionsDelta,
      internalExclusionsDelta
    );

    rows.push({
      studentId: student.id,
      studentName: student.fullName,
      yearGroup: student.yearGroup,
      status: "ACTIVE",
      sendFlag: student.sendFlag,
      ppFlag: student.ppFlag,
      band,
      riskScore,
      confidence,
      lastSnapshotDate: currentSnap.snapshotDate,
      drivers,
      attendancePct: attendanceCurrent ? Number(attendanceCurrent.attendancePct) : null,
      detentionsCount: currentSnap.detentionsCount ?? null,
      onCallsCount: currentSnap.onCallsCount ?? null,
      detentionsDelta,
      onCallsDelta,
      latenessDelta,
      suspensionsDelta,
      internalExclusionsDelta,
      attendanceDelta,
      positivePointsTotal: currentSnap.positivePointsTotal ?? 0,
      onWatchlist: (student.watchlistEntries ?? []).length > 0,
    });
  }
  }

  if (statusFilter === "ARCHIVED" || statusFilter === "ALL") {
    const archivedStudents = await (prisma as any).student.findMany({
      where: { tenantId, status: "ARCHIVED" },
      include: {
        snapshots: { orderBy: { snapshotDate: "desc" }, take: 1 },
        watchlistEntries: { where: { tenantId, createdByUserId: viewerUserId } },
      },
    });

    for (const student of archivedStudents as any[]) {
      const latest = (student.snapshots ?? [])[0] ?? null;
      rows.push({
        studentId: student.id,
        studentName: student.fullName,
        yearGroup: student.yearGroup,
        status: "ARCHIVED",
        sendFlag: student.sendFlag,
        ppFlag: student.ppFlag,
        band: "STABLE",
        riskScore: 0,
        confidence: "LOW",
        lastSnapshotDate: latest?.snapshotDate ?? null,
        drivers: [],
        attendancePct: latest ? Number(latest.attendancePct) : null,
        detentionsCount: latest?.detentionsCount ?? null,
        onCallsCount: latest?.onCallsCount ?? null,
        detentionsDelta: null,
        onCallsDelta: null,
        latenessDelta: null,
        suspensionsDelta: null,
        internalExclusionsDelta: null,
        attendanceDelta: null,
        positivePointsTotal: latest?.positivePointsTotal ?? null,
        onWatchlist: (student.watchlistEntries ?? []).length > 0,
      });
    }
  }

  // Sort: URGENT → PRIORITY → WATCH → STABLE, then by riskScore desc
  rows.sort((a, b) => {
    const bandDiff = BAND_ORDER[a.band] - BAND_ORDER[b.band];
    if (bandDiff !== 0) return bandDiff;
    return b.riskScore - a.riskScore;
  });

  return { rows, computedAt: new Date() };
}

/**
 * Compute the detailed risk profile for a single student.
 */
export async function computeStudentRiskProfile(
  tenantId: string,
  studentId: string,
  windowDays: number = DEFAULT_WINDOW_DAYS,
  viewerUserId: string
): Promise<StudentRiskProfile | null> {
  const { currentStart, currentEnd, prevStart, prevEnd } = windowBounds(windowDays);

  const student = await (prisma as any).student.findFirst({
    where: { id: studentId, tenantId },
    include: {
      snapshots: {
        // Fetch the full comparison range (both the current and the prior window) by
        // date, not a fixed row count -- a `take` cap here silently stops the prior
        // window's snapshot from ever being reached once windowDays is large enough
        // that two windows' worth of daily snapshots exceeds the cap, making every
        // delta in this profile show as "no change" even when the data moved.
        where: { snapshotDate: { gte: prevStart, lte: currentEnd } },
        orderBy: { snapshotDate: "desc" },
      },
      watchlistEntries: {
        where: { tenantId, createdByUserId: viewerUserId },
      },
    },
  });

  if (!student) return null;

  const snapshots: any[] = student.snapshots ?? [];

  const currentSnap = snapshots.find(
    (s: any) => s.snapshotDate >= currentStart && s.snapshotDate <= currentEnd
  );
  const prevSnap = snapshots.find(
    (s: any) => s.snapshotDate >= prevStart && s.snapshotDate < currentStart
  );

  const confidence: Confidence = prevSnap ? "HIGH" : "LOW";

  const attendanceDelta = prevSnap
    ? Number(currentSnap?.attendancePct ?? 0) - Number(prevSnap.attendancePct)
    : null;
  const onCallsDelta = prevSnap && currentSnap
    ? currentSnap.onCallsCount - prevSnap.onCallsCount
    : null;
  const detentionsDelta = prevSnap && currentSnap
    ? currentSnap.detentionsCount - prevSnap.detentionsCount
    : null;
  const latenessDelta = prevSnap && currentSnap
    ? currentSnap.latenessCount - prevSnap.latenessCount
    : null;
  const currentWindowSnapshots = snapshots.filter((s: any) => s.snapshotDate >= currentStart && s.snapshotDate <= currentEnd);
  const previousWindowSnapshots = snapshots.filter((s: any) => s.snapshotDate >= prevStart && s.snapshotDate < currentStart);
  const currentSuspensions = highestCumulative(currentWindowSnapshots, "suspensionsCount");
  const previousSuspensions = highestCumulative(previousWindowSnapshots, "suspensionsCount");
  const suspensionsDelta = prevSnap && currentSnap
    ? currentSuspensions - previousSuspensions
    : null;
  const internalExclusionsDelta = prevSnap && currentSnap
    ? currentSnap.internalExclusionsCount - prevSnap.internalExclusionsCount
    : null;
  const positivePointsDelta = prevSnap && currentSnap
    ? (currentSnap.positivePointsTotal ?? 0) - (prevSnap.positivePointsTotal ?? 0)
    : null;

  const riskScore = computeRiskScore({
    attendanceDelta,
    onCallsDelta,
    detentionsDelta,
    latenessDelta,
    suspensionsDelta,
    internalExclusionsDelta,
  });

  const band = scoreToBand(riskScore);
  const drivers = buildDrivers(
    attendanceDelta,
    onCallsDelta,
    detentionsDelta,
    latenessDelta,
    suspensionsDelta,
    internalExclusionsDelta
  );

  // Last 3 snapshots for trend display
  const recentSnapshots = snapshots.slice(0, 3).map(toSnapshotSummary);

  return {
    studentId: student.id,
    studentName: student.fullName,
    yearGroup: student.yearGroup,
    sendFlag: student.sendFlag,
    ppFlag: student.ppFlag,
    band,
    riskScore,
    confidence,
    lastSnapshotDate: currentSnap?.snapshotDate ?? null,
    drivers,
    currentSnapshot: currentSnap ? { ...toSnapshotSummary(currentSnap), suspensionsCount: currentSuspensions } : null,
    baselineSnapshot: prevSnap ? { ...toSnapshotSummary(prevSnap), suspensionsCount: previousSuspensions } : null,
    attendanceDelta,
    onCallsDelta,
    detentionsDelta,
    latenessDelta,
    suspensionsDelta,
    internalExclusionsDelta,
    positivePointsDelta,
    recentSnapshots,
    onWatchlist: (student.watchlistEntries ?? []).length > 0,
    computedAt: new Date(),
  };
}
