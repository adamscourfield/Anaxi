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
export function startOfWeekMonday(d: Date): Date {
  const x = startOfDay(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

/** Monday-based week id (local), matches chart buckets. */
export function observationWeekKey(d: Date): string {
  const w = startOfWeekMonday(d);
  const y = w.getFullYear();
  const m = String(w.getMonth() + 1).padStart(2, "0");
  const day = String(w.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** UK academic year: 1 Sep → following 31 Aug (inclusive). */
export function academicYearBounds(anchor: Date): { start: Date; end: Date } {
  const y = anchor.getFullYear();
  const thisSept = startOfDay(new Date(y, 8, 1));
  const start = anchor >= thisSept ? thisSept : startOfDay(new Date(y - 1, 8, 1));
  const end = endOfDay(new Date(start.getFullYear() + 1, 7, 31));
  return { start, end };
}

export type ObservationAnalysisPreset = "week" | "month" | "academic_year" | "26w";

export const OBSERVATION_ANALYSIS_PRESETS: ObservationAnalysisPreset[] = [
  "week",
  "month",
  "academic_year",
  "26w",
];

export function parseObservationAnalysisPreset(raw: string): ObservationAnalysisPreset | null {
  return OBSERVATION_ANALYSIS_PRESETS.includes(raw as ObservationAnalysisPreset)
    ? (raw as ObservationAnalysisPreset)
    : null;
}

/** Preset window ending at `anchor` (typically “now”). */
export function presetRange(
  preset: ObservationAnalysisPreset,
  anchor: Date,
): { start: Date; end: Date; label: string } {
  const end = new Date(anchor);
  if (preset === "week") {
    const start = startOfDay(new Date(end));
    start.setDate(start.getDate() - 6);
    return {
      start,
      end,
      label: "Last 7 days",
    };
  }
  if (preset === "month") {
    const start = startOfDay(new Date(end));
    start.setDate(start.getDate() - 29);
    return {
      start,
      end,
      label: "Last 30 days",
    };
  }
  if (preset === "academic_year") {
    const { start, end: ayEnd } = academicYearBounds(end);
    const cappedEnd = end.getTime() > ayEnd.getTime() ? ayEnd : end;
    return {
      start,
      end: cappedEnd,
      label: "Academic year (1 Sep – 31 Aug)",
    };
  }
  const start = new Date(end);
  start.setDate(start.getDate() - 26 * 7);
  const s = startOfWeekMonday(start);
  return {
    start: s,
    end,
    label: "Last ~26 weeks",
  };
}

export type FilterDateBounds = { start: Date; end: Date } | null;

/** Bounds implied by history filter params (same semantics as list query). */
export function observationFilterDateBounds(params: {
  from: string;
  to: string;
  useWindow: boolean;
  windowStart: Date | null;
}): FilterDateBounds {
  const { from, to, useWindow, windowStart } = params;
  if (useWindow && windowStart) {
    return { start: new Date(windowStart), end: new Date() };
  }
  if (from && to) {
    return { start: startOfDay(new Date(from)), end: endOfDay(new Date(to)) };
  }
  if (from && !to) {
    return { start: startOfDay(new Date(from)), end: new Date() };
  }
  if (!from && to) {
    return { start: new Date(0), end: endOfDay(new Date(to)) };
  }
  return null;
}

export function intersectDateRanges(
  a: { start: Date; end: Date },
  b: { start: Date; end: Date },
): { start: Date; end: Date } | null {
  const start = new Date(Math.max(a.start.getTime(), b.start.getTime()));
  const end = new Date(Math.min(a.end.getTime(), b.end.getTime()));
  if (start > end) return null;
  return { start, end };
}

export type ResolvedObservationAnalysisRange = {
  start: Date;
  end: Date;
  label: string;
  preset: ObservationAnalysisPreset;
  emptyIntersection: boolean;
};

/**
 * Final chart window: preset range ∩ filter date bounds (when filters include dates).
 * When filters have no dates, preset range alone is used.
 */
export function resolveObservationAnalysisRangeUnified(params: {
  analysisPreset: ObservationAnalysisPreset;
  from: string;
  to: string;
  useWindow: boolean;
  windowStart: Date | null;
  /** Optional clock override (tests). */
  now?: Date;
}): ResolvedObservationAnalysisRange {
  const now = params.now ?? new Date();
  const preset = presetRange(params.analysisPreset, now);
  const filterBounds = observationFilterDateBounds({
    from: params.from,
    to: params.to,
    useWindow: params.useWindow,
    windowStart: params.windowStart,
  });

  if (!filterBounds) {
    return {
      start: preset.start,
      end: preset.end,
      label: preset.label,
      preset: params.analysisPreset,
      emptyIntersection: false,
    };
  }

  const inter = intersectDateRanges(
    { start: preset.start, end: preset.end },
    filterBounds,
  );
  if (!inter) {
    return {
      start: preset.start,
      end: preset.end,
      label: `${preset.label} (no overlap with table date filters)`,
      preset: params.analysisPreset,
      emptyIntersection: true,
    };
  }

  const fmt = (d: Date) =>
    d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  return {
    start: inter.start,
    end: inter.end,
    label: `${preset.label} · ${fmt(inter.start)} – ${fmt(inter.end)}`,
    preset: params.analysisPreset,
    emptyIntersection: false,
  };
}
