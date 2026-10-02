export type SnapshotMetric = {
  snapshotDate: Date;
  attendancePct: number;
  detentionsCount: number;
  internalExclusionsCount: number;
  suspensionsCount: number;
  onCallsCount: number;
  latenessCount: number;
};

export function avg(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Default rolling window (days) used when the caller doesn't specify one. */
export const DEFAULT_FLAG_WINDOW_DAYS = 7;

/** Rolling windows offered for "who's changed the most" comparisons. */
export const FLAG_WINDOW_OPTIONS_DAYS = [7, 21, 28] as const;
export type FlagWindowDays = (typeof FLAG_WINDOW_OPTIONS_DAYS)[number];

export function pickWindows(snapshots: SnapshotMetric[], windowDays: number = DEFAULT_FLAG_WINDOW_DAYS) {
  const sorted = [...snapshots].sort((a, b) => +new Date(a.snapshotDate) - +new Date(b.snapshotDate));
  if (sorted.length < 2) return null;

  const latest = sorted[sorted.length - 1].snapshotDate;
  const currentStart = new Date(+new Date(latest) - windowDays * 24 * 3600 * 1000);
  const baselineStart = new Date(+new Date(latest) - 5 * windowDays * 24 * 3600 * 1000);
  const baselineEnd = new Date(+new Date(latest) - (windowDays + 1) * 24 * 3600 * 1000);

  const current = sorted.filter((s) => new Date(s.snapshotDate) >= currentStart);
  const baseline = sorted.filter((s) => new Date(s.snapshotDate) >= baselineStart && new Date(s.snapshotDate) <= baselineEnd);

  if (current.length === 0 || baseline.length === 0) {
    return {
      sparse: true,
      current: [sorted[sorted.length - 1]],
      baseline: [sorted[sorted.length - 2]]
    };
  }

  return { sparse: false, current, baseline };
}

export function computeFlags(snapshots: SnapshotMetric[], windowDays: number = DEFAULT_FLAG_WINDOW_DAYS) {
  const windows = pickWindows(snapshots, windowDays);
  if (!windows) return [];

  const b = windows.baseline;
  const c = windows.current;

  const metrics = {
    baselineAttendance: avg(b.map((x) => x.attendancePct)),
    currentAttendance: avg(c.map((x) => x.attendancePct)),
    baselineDetentions: avg(b.map((x) => x.detentionsCount)),
    currentDetentions: avg(c.map((x) => x.detentionsCount)),
    baselineInternalExclusions: avg(b.map((x) => x.internalExclusionsCount)),
    currentInternalExclusions: avg(c.map((x) => x.internalExclusionsCount)),
    baselineSuspensions: avg(b.map((x) => x.suspensionsCount)),
    currentSuspensions: avg(c.map((x) => x.suspensionsCount)),
    baselineOnCalls: avg(b.map((x) => x.onCallsCount)),
    currentOnCalls: avg(c.map((x) => x.onCallsCount)),
    baselineLateness: avg(b.map((x) => x.latenessCount)),
    currentLateness: avg(c.map((x) => x.latenessCount))
  };

  const flags: Array<{ flagKey: string; severity: "LOW" | "MEDIUM" | "HIGH"; details: any }> = [];

  const attendanceDelta = metrics.baselineAttendance - metrics.currentAttendance;
  if (attendanceDelta >= 5) flags.push({ flagKey: "ATTENDANCE_DROP", severity: "HIGH", details: { ...metrics, attendanceDelta } });
  else if (attendanceDelta >= 2) flags.push({ flagKey: "ATTENDANCE_DROP", severity: "MEDIUM", details: { ...metrics, attendanceDelta } });

  const ratioFlag = (key: string, current: number, baseline: number, mediumDelta = 2, highDelta = 4) => {
    const delta = current - baseline;
    if (baseline > 0 && current > baseline * 2 && delta >= highDelta) flags.push({ flagKey: key, severity: "HIGH", details: { baseline, current, delta } });
    else if (baseline > 0 && current > baseline * 1.5 && delta >= mediumDelta) flags.push({ flagKey: key, severity: "MEDIUM", details: { baseline, current, delta } });
  };

  ratioFlag("DETENTIONS_SPIKE", metrics.currentDetentions, metrics.baselineDetentions);
  ratioFlag("ON_CALLS_SPIKE", metrics.currentOnCalls, metrics.baselineOnCalls);
  ratioFlag("LATENESS_SPIKE", metrics.currentLateness, metrics.baselineLateness);
  ratioFlag("INTERNAL_EXCLUSIONS_SPIKE", metrics.currentInternalExclusions, metrics.baselineInternalExclusions);

  if (metrics.currentSuspensions > metrics.baselineSuspensions && metrics.currentSuspensions > 0) {
    flags.push({ flagKey: "SUSPENSIONS_NEW", severity: "HIGH", details: { baseline: metrics.baselineSuspensions, current: metrics.currentSuspensions } });
  }

  return flags;
}
