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
  // Deltas
  attendanceDelta: number | null;
  onCallsDelta: number | null;
  detentionsDelta: number | null;
  latenessDelta: number | null;
  suspensionsDelta: number | null;
  internalExclusionsDelta: number | null;
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
        where: { snapshotDate: { gte: prevStart, lte: currentEnd } },
        orderBy: { snapshotDate: "desc" },
      },
      watchlistEntries: {
        where: { tenantId, createdByUserId: viewerUserId },
      },
    },
  });

  for (const student of students as any[]) {
    const snapshots: any[] = student.snapshots ?? [];

    const currentSnap = snapshots.find(
      (s: any) => s.snapshotDate >= currentStart && s.snapshotDate <= currentEnd
    );
    const prevSnap = snapshots.find(
      (s: any) => s.snapshotDate >= prevStart && s.snapshotDate < currentStart
    );

    // Exclude students with no recent data
    if (!currentSnap) continue;

    const confidence: Confidence = prevSnap ? "HIGH" : "LOW";

    const attendanceDelta = prevSnap
      ? Number(currentSnap.attendancePct) - Number(prevSnap.attendancePct)
      : null;
    const onCallsDelta = prevSnap ? currentSnap.onCallsCount - prevSnap.onCallsCount : null;
    const detentionsDelta = prevSnap ? currentSnap.detentionsCount - prevSnap.detentionsCount : null;
    const latenessDelta = prevSnap ? currentSnap.latenessCount - prevSnap.latenessCount : null;
    const suspensionsDelta = prevSnap
      ? currentSnap.suspensionsCount - prevSnap.suspensionsCount
      : null;
    const internalExclusionsDelta = prevSnap
      ? currentSnap.internalExclusionsCount - prevSnap.internalExclusionsCount
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
      attendancePct: Number(currentSnap.attendancePct),
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
        orderBy: { snapshotDate: "desc" },
        take: 10,
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
  const suspensionsDelta = prevSnap && currentSnap
    ? currentSnap.suspensionsCount - prevSnap.suspensionsCount
    : null;
  const internalExclusionsDelta = prevSnap && currentSnap
    ? currentSnap.internalExclusionsCount - prevSnap.internalExclusionsCount
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
    currentSnapshot: currentSnap ? toSnapshotSummary(currentSnap) : null,
    attendanceDelta,
    onCallsDelta,
    detentionsDelta,
    latenessDelta,
    suspensionsDelta,
    internalExclusionsDelta,
    recentSnapshots,
    onWatchlist: (student.watchlistEntries ?? []).length > 0,
    computedAt: new Date(),
  };
}
