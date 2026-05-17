/**
 * Attainment–Behaviour Correlation Analysis
 *
 * Computes Pearson correlation coefficients between student behaviour /
 * pastoral metrics (from StudentSnapshot) and attainment (from
 * AssessmentResult.normalizedScore) for students who appear in both datasets.
 *
 * Correlations are computed school-wide and broken down by SEND / PP group.
 * Confidence is flagged LOW when the paired sample is fewer than 10 students.
 */

import { prisma } from "@/lib/prisma";

// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_PAIRS = 10;

// ─── Types ────────────────────────────────────────────────────────────────────

export type CorrelationStrength =
  | "STRONG_POSITIVE"
  | "MODERATE_POSITIVE"
  | "WEAK"
  | "MODERATE_NEGATIVE"
  | "STRONG_NEGATIVE";

export type CorrelationRow = {
  metric: string;
  metricLabel: string;
  correlation: number;
  sampleSize: number;
  confidence: "HIGH" | "LOW";
  strength: CorrelationStrength;
};

export type GroupCorrelations = {
  send: CorrelationRow[];
  nonSend: CorrelationRow[];
  pp: CorrelationRow[];
  nonPp: CorrelationRow[];
};

export type AttainmentBehaviourCorrelationResult = {
  schoolWide: CorrelationRow[];
  byGroup: GroupCorrelations;
  pairedStudentCount: number;
  computedAt: Date;
};

// ─── Pure helpers (exported for testing) ─────────────────────────────────────

export function pearsonR(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < 2 || n !== ys.length) return null;

  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  const den = Math.sqrt(denX * denY);
  if (den === 0) return null;
  return num / den;
}

export function correlationStrength(r: number): CorrelationStrength {
  const abs = Math.abs(r);
  if (abs < 0.1) return "WEAK";
  if (r >= 0.5) return "STRONG_POSITIVE";
  if (r <= -0.5) return "STRONG_NEGATIVE";
  if (r > 0) return "MODERATE_POSITIVE";
  return "MODERATE_NEGATIVE";
}

// ─── Internal types ───────────────────────────────────────────────────────────

type StudentPairedData = {
  normalizedScore: number;
  attendancePct: number;
  detentionsCount: number;
  onCallsCount: number;
  latenessCount: number;
  positivePointsTotal: number;
  sendFlag: boolean;
  ppFlag: boolean;
};

type MetricDef = {
  key: keyof Omit<StudentPairedData, "normalizedScore" | "sendFlag" | "ppFlag">;
  label: string;
};

const METRICS: MetricDef[] = [
  { key: "attendancePct", label: "Attendance %" },
  { key: "detentionsCount", label: "Detentions" },
  { key: "onCallsCount", label: "On-call incidents" },
  { key: "latenessCount", label: "Lateness" },
  { key: "positivePointsTotal", label: "Positive points" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildCorrelationRows(
  pairs: StudentPairedData[],
): CorrelationRow[] {
  return METRICS.map(({ key, label }) => {
    const xs = pairs.map((p) => p[key] as number);
    const ys = pairs.map((p) => p.normalizedScore);
    const r = pearsonR(xs, ys);
    const correlation = r ?? 0;
    return {
      metric: key,
      metricLabel: label,
      correlation,
      sampleSize: pairs.length,
      confidence: pairs.length >= MIN_PAIRS ? "HIGH" : "LOW",
      strength: correlationStrength(correlation),
    };
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function computeAttainmentBehaviourCorrelation(
  tenantId: string,
  windowDays: number,
): Promise<AttainmentBehaviourCorrelationResult> {
  const since = new Date();
  since.setDate(since.getDate() - windowDays);

  const empty: AttainmentBehaviourCorrelationResult = {
    schoolWide: METRICS.map(({ key, label }) => ({
      metric: key,
      metricLabel: label,
      correlation: 0,
      sampleSize: 0,
      confidence: "LOW",
      strength: "WEAK",
    })),
    byGroup: { send: [], nonSend: [], pp: [], nonPp: [] },
    pairedStudentCount: 0,
    computedAt: new Date(),
  };

  // ── 1. Latest assessment results (most recent active cycle point) ───────────

  const cycles = await (prisma as any).assessmentCycle.findMany({
    where: { tenantId, isActive: true },
    include: {
      points: {
        where: { resultStatus: { in: ["PUBLISHED", "VALIDATED", "LOCKED"] } },
        orderBy: { ordinal: "desc" },
        take: 1,
        select: { id: true },
      },
    },
  });

  const currentPointIds = (cycles as any[])
    .flatMap((c: any) => c.points.map((p: any) => p.id))
    .filter(Boolean);

  if (currentPointIds.length === 0) return empty;

  const assessments = await (prisma as any).assessment.findMany({
    where: { tenantId, pointId: { in: currentPointIds } },
    select: { id: true },
  });
  const assessmentIds = (assessments as any[]).map((a: any) => a.id);

  const results = await (prisma as any).assessmentResult.findMany({
    where: {
      tenantId,
      assessmentId: { in: assessmentIds },
      status: "PRESENT",
      isValid: true,
    },
    select: { studentId: true, normalizedScore: true },
  });

  // Average normalizedScore per student across subjects (if multiple)
  const scoreByStudent = new Map<string, number[]>();
  for (const r of results as any[]) {
    if (r.normalizedScore === null) continue;
    if (!scoreByStudent.has(r.studentId)) scoreByStudent.set(r.studentId, []);
    scoreByStudent.get(r.studentId)!.push(Number(r.normalizedScore));
  }

  if (scoreByStudent.size === 0) return empty;

  const studentIdsWithScores = Array.from(scoreByStudent.keys());

  // ── 2. Latest snapshots for the same students ───────────────────────────────

  const students = await (prisma as any).student.findMany({
    where: { tenantId, id: { in: studentIdsWithScores } },
    select: {
      id: true,
      sendFlag: true,
      ppFlag: true,
      snapshots: {
        where: { snapshotDate: { gte: since } },
        orderBy: { snapshotDate: "desc" },
        take: 1,
        select: {
          attendancePct: true,
          detentionsCount: true,
          onCallsCount: true,
          latenessCount: true,
          positivePointsTotal: true,
        },
      },
    },
  });

  // ── 3. Build paired dataset ─────────────────────────────────────────────────

  const pairs: StudentPairedData[] = [];

  for (const s of students as any[]) {
    const snap = s.snapshots?.[0];
    if (!snap) continue;
    const scores = scoreByStudent.get(s.id);
    if (!scores || scores.length === 0) continue;
    const normalizedScore = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;

    pairs.push({
      normalizedScore,
      attendancePct: Number(snap.attendancePct ?? 0),
      detentionsCount: snap.detentionsCount ?? 0,
      onCallsCount: snap.onCallsCount ?? 0,
      latenessCount: snap.latenessCount ?? 0,
      positivePointsTotal: snap.positivePointsTotal ?? 0,
      sendFlag: s.sendFlag,
      ppFlag: s.ppFlag,
    });
  }

  if (pairs.length === 0) return empty;

  // ── 4. Compute correlations ─────────────────────────────────────────────────

  const schoolWide = buildCorrelationRows(pairs);
  const sendPairs = pairs.filter((p) => p.sendFlag);
  const nonSendPairs = pairs.filter((p) => !p.sendFlag);
  const ppPairs = pairs.filter((p) => p.ppFlag);
  const nonPpPairs = pairs.filter((p) => !p.ppFlag);

  return {
    schoolWide,
    byGroup: {
      send: buildCorrelationRows(sendPairs),
      nonSend: buildCorrelationRows(nonSendPairs),
      pp: buildCorrelationRows(ppPairs),
      nonPp: buildCorrelationRows(nonPpPairs),
    },
    pairedStudentCount: pairs.length,
    computedAt: new Date(),
  };
}
