"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ObservationAnalysisPreset } from "@/modules/observations/observationHistoryAnalysisRange";
import { OBSERVATION_ANALYSIS_PRESETS } from "@/modules/observations/observationHistoryAnalysisRange";
import { FormSelect } from "@/components/ui/form-select";

export type RoleCountSerialized = { role: string; label: string; count: number };

export type PairWeeklySerialized = {
  coachId: string;
  coacheeId: string;
  coachName: string;
  coacheeName: string;
  observationCount: number;
  weeksWithObservation: number;
  weekLabels: string[];
  weekHit: boolean[];
  weekObservationIds: (string | null)[];
  weekObservationDates: (string | null)[];
};

export type TimelineWeekSerialized = { weekKey: string; label: string; count: number };

const PRESET_META: Record<
  ObservationAnalysisPreset,
  { label: string; short: string }
> = {
  week: { label: "Last week", short: "Week" },
  month: { label: "Last month", short: "Month" },
  academic_year: { label: "Academic year", short: "Academic year" },
  "26w": { label: "~26 weeks", short: "26 weeks" },
};

type TooltipState = { x: number; y: number; text: string } | null;

/** Viewport padding when clamping the floating chart tooltip. */
const TOOLTIP_MARGIN = 10;
const TOOLTIP_GAP = 10;

function ChartTooltip({ state }: { state: TooltipState }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!state) {
      setPos(null);
      return;
    }
    const el = ref.current;
    const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
    const vh = typeof window !== "undefined" ? window.innerHeight : 800;
    const w = el?.offsetWidth ?? 200;
    const h = el?.offsetHeight ?? 48;
    let left = state.x + TOOLTIP_GAP;
    let top = state.y + TOOLTIP_GAP;
    if (left + w + TOOLTIP_MARGIN > vw) {
      left = state.x - w - TOOLTIP_GAP;
    }
    if (top + h + TOOLTIP_MARGIN > vh) {
      top = state.y - h - TOOLTIP_GAP;
    }
    left = Math.min(Math.max(left, TOOLTIP_MARGIN), Math.max(TOOLTIP_MARGIN, vw - w - TOOLTIP_MARGIN));
    top = Math.min(Math.max(top, TOOLTIP_MARGIN), Math.max(TOOLTIP_MARGIN, vh - h - TOOLTIP_MARGIN));
    setPos({ left, top });
  }, [state]);

  if (!state) return null;

  /** Portal keeps `position:fixed` aligned with viewport coordinates from mouse events (avoids offset when a transformed ancestor creates a containing block). */
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={ref}
      className="pointer-events-none fixed z-[100] max-w-[min(280px,calc(100vw-1.5rem))] rounded-sm border border-border bg-[var(--surface-container-lowest)] px-3.5 py-2.5 text-[0.8125rem] text-text shadow-none"
      style={{
        left: pos?.left ?? state.x + TOOLTIP_GAP,
        top: pos?.top ?? state.y + TOOLTIP_GAP,
        visibility: pos ? "visible" : "hidden",
      }}
      role="tooltip"
    >
      <div className="whitespace-pre-wrap">
        {state.text.split("\n").map((line, i) =>
          i === 0 ? (
            <p key={i} className="font-bold text-[#111827]">
              {line}
            </p>
          ) : (
            <p key={i} className="mt-0.5 text-[#6B7280]">
              {line}
            </p>
          ),
        )}
      </div>
    </div>,
    document.body,
  );
}

/** Plot area inside the timeline SVG (must match line chart geometry). */
const TIMELINE_PAD = { L: 36, R: 8, T: 12, B: 28, W: 640, H: 160 };

/** Primary ink for observation intelligence charts (ledger / monochrome mock). */
const OBS_CHART_INK = "#111827";
const OBS_CHART_INK_SOFT = "#374151";
/** Bar fill: deep slate → softer slate (horizontal emphasis without violet chrome). */
const ROLE_BAR_GRADIENT = `linear-gradient(90deg, ${OBS_CHART_INK} 0%, ${OBS_CHART_INK_SOFT} 100%)`;

function CalendarOutlineIcon({
  className,
  stroke = OBS_CHART_INK,
}: {
  className?: string;
  stroke?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth="2"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
    </svg>
  );
}

function InfoCircleIcon({ title: ariaLabel }: { title: string }) {
  return (
    <span className="inline-flex shrink-0 text-[#9CA3AF]" title={ariaLabel} aria-label={ariaLabel}>
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4M12 8h.01" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function ChevronDownMini({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function clientToSvgPoint(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } | null {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const inv = ctm.inverse();
  const svgP = pt.matrixTransform(inv);
  return { x: svgP.x, y: svgP.y };
}

function nearestTimelineIndex(svgX: number, n: number, innerW: number, padL: number): number {
  if (n <= 0) return 0;
  if (n === 1) return 0;
  const innerX = svgX - padL;
  const t = Math.max(0, Math.min(1, innerX / innerW));
  return Math.round(t * (n - 1));
}

type PolyPoint = { x: number; y: number };

/**
 * Clamp targetX to the polyline's x-range and return the point on the line plus an SVG path
 * from the first vertex through vertices up to that point (for a “traveled” stroke).
 */
function pointOnPolylineAtX(pts: PolyPoint[], targetX: number): { x: number; y: number; pathD: string } | null {
  if (pts.length === 0) return null;
  if (pts.length === 1) {
    const p = pts[0];
    return { x: p.x, y: p.y, pathD: `M ${p.x} ${p.y}` };
  }
  const x0 = pts[0].x;
  const xLast = pts[pts.length - 1].x;
  const tx = Math.max(x0, Math.min(xLast, targetX));

  let i = 0;
  while (i < pts.length - 1 && pts[i + 1].x < tx) i += 1;

  if (i >= pts.length - 1) {
    const last = pts[pts.length - 1];
    const pathD = pts.map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    return { x: last.x, y: last.y, pathD };
  }

  const a = pts[i];
  const b = pts[i + 1];
  const denom = b.x - a.x;
  const t = denom === 0 ? 0 : (tx - a.x) / denom;
  const y = a.y + t * (b.y - a.y);

  let pathD = `M ${pts[0].x} ${pts[0].y}`;
  for (let k = 1; k <= i; k++) {
    pathD += ` L ${pts[k].x} ${pts[k].y}`;
  }
  pathD += ` L ${tx} ${y}`;
  return { x: tx, y, pathD };
}

type Props = {
  rangeLabel: string;
  analysisPreset: ObservationAnalysisPreset;
  emptyIntersection: boolean;
  /** True when chart window uses table dates only because preset did not overlap filters */
  chartFellBackToTableDates: boolean;
  /** Query string without `page` or `analysis` — used to build preset links */
  historyFilterQueryString: string;
  roleCounts: RoleCountSerialized[];
  pairWeekly: PairWeeklySerialized[];
  timelineWeeks: TimelineWeekSerialized[];
  showCoachingSection: boolean;
  coachingCoachFilterOptions: { id: string; fullName: string }[];
  coachingCoacheeFilterOptions: { id: string; fullName: string }[];
  coachingCoachId: string;
  coachingCoacheeId: string;
};

type TimelineSeriesMode = "weekly" | "cumulative" | "moving_avg";

function buildChartTimelineWeeks(
  weeks: TimelineWeekSerialized[],
  mode: TimelineSeriesMode,
): TimelineWeekSerialized[] {
  if (weeks.length === 0) return [];
  if (mode === "weekly") return weeks;

  if (mode === "cumulative") {
    let run = 0;
    return weeks.map((w) => {
      run += w.count;
      return { ...w, count: run };
    });
  }

  return weeks.map((w, i) => {
    const start = Math.max(0, i - 3);
    const slice = weeks.slice(start, i + 1);
    const avg = slice.reduce((s, x) => s + x.count, 0) / slice.length;
    return { ...w, count: Math.round(avg * 10) / 10 };
  });
}

function formatChartCount(mode: TimelineSeriesMode, count: number): string {
  if (mode === "moving_avg") {
    return count.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 1 });
  }
  return Math.round(count).toLocaleString("en-GB");
}

function timelineTooltipMetricLine(mode: TimelineSeriesMode, count: number): string {
  const n = formatChartCount(mode, count);
  if (mode === "weekly") {
    const c = Math.round(count);
    return `${n} observation${c === 1 ? "" : "s"} this week`;
  }
  if (mode === "cumulative") return `${n} observations cumulative (through this week)`;
  return `${n} avg observations/week (4-week window)`;
}

function barWidthPct(count: number, max: number): number {
  if (max === 0) return 0;
  return Math.round((count / max) * 100);
}

function formatObsDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function analysisHref(preset: ObservationAnalysisPreset, baseQuery: string): string {
  const params = new URLSearchParams(baseQuery);
  if (preset === "26w") params.delete("analysis");
  else params.set("analysis", preset);
  const qs = params.toString();
  return `/observe/history${qs ? `?${qs}` : ""}`;
}

function CoachingPairFilterForm({
  historyFilterQueryString,
  coachOptions,
  coacheeOptions,
  coachId,
  coacheeId,
}: {
  historyFilterQueryString: string;
  coachOptions: { id: string; fullName: string }[];
  coacheeOptions: { id: string; fullName: string }[];
  coachId: string;
  coacheeId: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const base = new URLSearchParams(historyFilterQueryString);
  base.delete("coachingCoach");
  base.delete("coachingCoachee");
  const triggerWhite = "field-filter-trigger obs-history-coaching-select !bg-background";

  /** Defer submit so FormSelect's hidden input reflects the new value (state updates are async). */
  const submitForm = useCallback(() => {
    window.setTimeout(() => formRef.current?.requestSubmit(), 0);
  }, []);

  return (
    <form
      ref={formRef}
      method="get"
      action="/observe/history"
      className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
    >
      {[...base.entries()].map(([k, v]) => (
        <input key={`${k}=${v}`} type="hidden" name={k} value={v} />
      ))}
      <label className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-[220px]">
        <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">Coach</span>
        <FormSelect
          name="coachingCoach"
          defaultValue={coachId}
          placeholder="All coaches"
          searchable
          triggerClassName={triggerWhite}
          onChange={submitForm}
          options={[{ value: "", label: "All coaches" }, ...coachOptions.map((u) => ({ value: u.id, label: u.fullName }))]}
        />
      </label>
      <label className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-[220px]">
        <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">Coachee</span>
        <FormSelect
          name="coachingCoachee"
          defaultValue={coacheeId}
          placeholder="All coachees"
          searchable
          triggerClassName={triggerWhite}
          onChange={submitForm}
          options={[
            { value: "", label: "All coachees" },
            ...coacheeOptions.map((u) => ({ value: u.id, label: u.fullName })),
          ]}
        />
      </label>
    </form>
  );
}

export function ObservationHistoryAnalysis({
  rangeLabel,
  analysisPreset,
  emptyIntersection,
  chartFellBackToTableDates,
  historyFilterQueryString,
  roleCounts,
  pairWeekly,
  timelineWeeks,
  showCoachingSection,
  coachingCoachFilterOptions,
  coachingCoacheeFilterOptions,
  coachingCoachId,
  coachingCoacheeId,
}: Props) {
  const [tip, setTip] = useState<TooltipState>(null);
  /** Nearest week index to cursor (tooltip + primary marker). */
  const [timelineSnapIdx, setTimelineSnapIdx] = useState<number | null>(null);
  /** Smoothed crosshair position on the line (SVG coords) + path for emphasized segment. */
  const [timelineGuide, setTimelineGuide] = useState<{ x: number; y: number; pathD: string } | null>(null);
  /** What the “Observations over time” line represents */
  const [timelineSeriesMode, setTimelineSeriesMode] = useState<TimelineSeriesMode>("weekly");

  const smoothCrosshairXRef = useRef<number | null>(null);
  const targetCrosshairXRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const cancelTimelineRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const chartSvgId = useId().replace(/[^a-zA-Z0-9_-]/g, "_");

  const showTip = useCallback((e: React.MouseEvent, text: string) => {
    setTip({
      x: e.clientX,
      y: e.clientY,
      text,
    });
  }, []);

  const moveTip = useCallback((e: React.MouseEvent) => {
    setTip((prev) =>
      prev
        ? {
            ...prev,
            x: e.clientX,
            y: e.clientY,
          }
        : null,
    );
  }, []);

  const hideTip = useCallback(() => {
    setTip(null);
    setTimelineSnapIdx(null);
    setTimelineGuide(null);
    cancelTimelineRaf();
    smoothCrosshairXRef.current = null;
    targetCrosshairXRef.current = null;
  }, [cancelTimelineRaf]);

  const maxRole = useMemo(() => Math.max(...roleCounts.map((r) => r.count), 1), [roleCounts]);

  const chartTimelineWeeks = useMemo(
    () => buildChartTimelineWeeks(timelineWeeks, timelineSeriesMode),
    [timelineWeeks, timelineSeriesMode],
  );

  const rawObservationsInWindow = useMemo(
    () => timelineWeeks.reduce((s, w) => s + w.count, 0),
    [timelineWeeks],
  );

  const maxTimeline = useMemo(() => {
    const m = Math.max(...chartTimelineWeeks.map((w) => w.count), 0);
    return m > 0 ? m : 1;
  }, [chartTimelineWeeks]);

  const linePoints = useMemo(() => {
    const n = chartTimelineWeeks.length;
    const { W: w, H: h, L: padL, R: padR, T: padT, B: padB } = TIMELINE_PAD;
    if (n === 0) {
      return {
        d: "",
        fillD: "",
        points: [] as { x: number; y: number; label: string; count: number; weekKey: string }[],
        w,
        h,
        padL,
        padR,
        padT,
        padB,
      };
    }
    const innerW = w - padL - padR;
    const innerH = h - padT - padB;
    const pts = chartTimelineWeeks.map((row, i) => {
      const x = padL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
      const y = padT + innerH - (row.count / maxTimeline) * innerH;
      return { x, y, label: row.label, count: row.count, weekKey: row.weekKey };
    });
    const lineD = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    const fillD = `${lineD} L ${pts[pts.length - 1].x.toFixed(1)} ${(padT + innerH).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(padT + innerH).toFixed(1)} Z`;
    return { d: lineD, fillD, points: pts, w, h, padL, padR, padT, padB };
  }, [chartTimelineWeeks, maxTimeline]);

  const linePointsRef = useRef(linePoints);
  linePointsRef.current = linePoints;

  const scheduleTimelineSmoothing = useCallback(() => {
    if (rafRef.current !== null) return;

    const tick = () => {
      const pts = linePointsRef.current.points;
      const target = targetCrosshairXRef.current;
      let sx = smoothCrosshairXRef.current;

      if (pts.length === 0 || target == null || sx == null) {
        rafRef.current = null;
        return;
      }

      const alpha = 0.26;
      sx += (target - sx) * alpha;
      if (Math.abs(sx - target) < 0.4) sx = target;
      smoothCrosshairXRef.current = sx;

      const on = pointOnPolylineAtX(pts, sx);
      if (on) setTimelineGuide({ x: on.x, y: on.y, pathD: on.pathD });

      if (Math.abs(sx - target) > 0.08) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => () => cancelTimelineRaf(), [cancelTimelineRaf]);

  useEffect(() => {
    smoothCrosshairXRef.current = null;
    targetCrosshairXRef.current = null;
    cancelTimelineRaf();
    setTimelineGuide(null);
    setTimelineSnapIdx(null);
    setTip(null);
  }, [linePoints.d, timelineSeriesMode, cancelTimelineRaf]);

  const handleTimelineSvgMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = e.currentTarget;
      const pts = linePoints.points;
      const n = pts.length;
      if (n === 0) return;

      const local = clientToSvgPoint(svg, e.clientX, e.clientY);
      if (!local) return;

      const { L, R, T, B, W, H } = TIMELINE_PAD;
      const innerW = W - L - R;
      const innerH = H - T - B;

      const inPlot =
        local.x >= L && local.x <= L + innerW && local.y >= T && local.y <= T + innerH;

      if (!inPlot) {
        setTimelineSnapIdx(null);
        setTimelineGuide(null);
        setTip(null);
        cancelTimelineRaf();
        smoothCrosshairXRef.current = null;
        targetCrosshairXRef.current = null;
        return;
      }

      const idx = nearestTimelineIndex(local.x, n, innerW, L);
      const p = pts[idx];
      if (!p) return;

      const weekStart = new Date(p.weekKey + "T12:00:00");
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const fmt = (d: Date) =>
        `${d.getDate()} ${d.toLocaleDateString("en-GB", { month: "short" })} ${d.getFullYear()}`;
      const rangeLine = `${fmt(weekStart)} – ${fmt(weekEnd)}`;

      setTimelineSnapIdx(idx);

      targetCrosshairXRef.current = local.x;
      if (smoothCrosshairXRef.current == null) {
        smoothCrosshairXRef.current = local.x;
        const on = pointOnPolylineAtX(pts, local.x);
        if (on) setTimelineGuide({ x: on.x, y: on.y, pathD: on.pathD });
      }
      scheduleTimelineSmoothing();

      setTip({
        x: e.clientX,
        y: e.clientY,
        text: `${rangeLine}\n${timelineTooltipMetricLine(timelineSeriesMode, p.count)}`,
      });
    },
    [linePoints.points, cancelTimelineRaf, scheduleTimelineSmoothing, timelineSeriesMode],
  );

  const handleTimelineSvgLeave = useCallback(() => {
    setTimelineSnapIdx(null);
    setTimelineGuide(null);
    setTip(null);
    cancelTimelineRaf();
    smoothCrosshairXRef.current = null;
    targetCrosshairXRef.current = null;
  }, [cancelTimelineRaf]);

  const timelineSvgPlot = useMemo(() => {
    const padL = linePoints.padL;
    const padR = linePoints.padR ?? TIMELINE_PAD.R;
    const padT = linePoints.padT;
    const padB = linePoints.padB;
    const plotW = linePoints.w - padL - padR;
    const plotH = linePoints.h - padT - padB;
    const pts = linePoints.points;
    const snapIdx = timelineSnapIdx;
    const guide = timelineGuide;
    const segmentD = guide?.pathD ?? "";
    const hoverX = guide?.x ?? null;
    return { padL, padT, padB, plotW, plotH, pts, snapIdx, segmentD, hoverX };
  }, [linePoints, timelineSnapIdx, timelineGuide]);

  const barTrack =
    "relative h-8 min-w-0 w-full overflow-hidden rounded-md bg-[#F3F4F6] calm-transition";

  const hasRoles = roleCounts.some((r) => r.count > 0);
  const hasTimeline = timelineWeeks.length > 0;

  const analysisCardClass = "obs-history-elevated-card";

  const segmentBase =
    "relative flex min-h-[2.5rem] flex-1 items-center justify-center rounded-md px-3 py-2 text-center text-[0.8125rem] font-semibold calm-transition focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--primary)_35%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-background";

  return (
    <section className="space-y-5" onMouseLeave={hideTip}>
      <ChartTooltip state={tip} />

      <div className={`${analysisCardClass} overflow-hidden p-5 md:p-6`}>
        <div className="flex flex-col gap-8 md:flex-row md:items-stretch md:gap-0">
          {/* Analysis copy + quick presets */}
          <div className="min-w-0 flex-1 md:pr-8">
            <p
              className="text-[0.6875rem] font-bold uppercase tracking-[0.1em] text-muted"
            >
              Analysis
            </p>
            <p className="mt-2 max-w-xl text-[0.8125rem] leading-relaxed text-muted">
              Charts use the same filters as the table. When you set table date filters, the chart window is the overlap
              with the range you pick below (UK academic year: 1 Sep – 31 Aug). Weeks start on Monday.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8125rem] text-muted">
              <Link
                href={analysisHref("week", historyFilterQueryString)}
                className="inline-flex items-center gap-1.5 calm-transition hover:text-text"
              >
                <CalendarOutlineIcon className="h-3.5 w-3.5 shrink-0" stroke="currentColor" />
                Last week (7 days)
              </Link>
              <span className="select-none text-muted/50" aria-hidden>
                ·
              </span>
              <Link
                href={analysisHref("month", historyFilterQueryString)}
                className="inline-flex items-center gap-1.5 calm-transition hover:text-text"
              >
                <CalendarOutlineIcon className="h-3.5 w-3.5 shrink-0" stroke="currentColor" />
                Last month (30 days)
              </Link>
              <span className="select-none text-muted/50" aria-hidden>
                ·
              </span>
              <Link
                href={analysisHref("academic_year", historyFilterQueryString)}
                className="inline-flex items-center gap-1.5 calm-transition hover:text-text"
              >
                <CalendarOutlineIcon className="h-3.5 w-3.5 shrink-0" stroke="currentColor" />
                Academic year ~26 weeks
              </Link>
            </div>
          </div>

          <div
            className="hidden shrink-0 self-stretch w-px bg-border/35 md:block"
            aria-hidden
          />

          {/* Current window + segmented control */}
          <div className="min-w-0 flex-1 md:pl-8">
            <p className="text-[0.6875rem] font-bold uppercase tracking-[0.1em] text-muted">
              Current window
            </p>
            <div className="mt-3 flex items-start gap-2.5">
              <CalendarOutlineIcon className="mt-0.5 h-6 w-6 shrink-0 text-muted" stroke="currentColor" />
              <p className="text-[0.9375rem] font-bold leading-snug text-neutral-950">
                {rangeLabel}
              </p>
            </div>
            <div
              className="mt-5 flex w-full gap-0.5 rounded-md bg-[#F3F4F6] p-0.5"
              role="group"
              aria-label="Chart time window"
            >
              {OBSERVATION_ANALYSIS_PRESETS.map((preset) => {
                const active = analysisPreset === preset;
                return (
                  <Link
                    key={preset}
                    href={analysisHref(preset, historyFilterQueryString)}
                    className={`${segmentBase} ${
                      active
                        ? "bg-neutral-950 text-white shadow-none"
                        : "text-[#6B7280] hover:bg-white/90 hover:text-text"
                    }`}
                    aria-current={active ? "true" : undefined}
                  >
                    {PRESET_META[preset].short}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {emptyIntersection ? (
          <p className="mt-6 rounded-lg border border-scale-some/30 bg-scale-some-light/80 px-3 py-2 text-[0.8125rem] text-text md:mt-8">
            {chartFellBackToTableDates
              ? "The chart range you picked does not overlap your table date filters, so the charts below use your table date range instead. Widen the table dates or choose another chart range."
              : "No overlap between this chart range and your table date filters — widen dates or pick another range."}
          </p>
        ) : null}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.38fr)_minmax(0,1fr)] lg:items-stretch">
        <div className={`${analysisCardClass} flex flex-col p-5 md:p-6`}>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[0.6875rem] font-bold uppercase tracking-[0.1em] text-[#6B7280]">
                Observations by observer role
              </h3>
              <InfoCircleIcon title="Counts reflect observers in your current table filters and the chart window above." />
            </div>
            <p className="mt-1 text-[0.8125rem] text-[#6B7280]">Hover a bar for the exact count.</p>
          </div>
          {!hasRoles ? (
            <p className="mt-4 text-sm text-muted">No observations in the current filter.</p>
          ) : (
            <>
              <ul className="mt-5 space-y-3.5">
                {roleCounts.map((row, rank) => {
                  const isLead = rank === 0;
                  const pct = barWidthPct(row.count, maxRole);
                  const barBg = row.count > 0 ? ROLE_BAR_GRADIENT : "transparent";
                  return (
                    <li key={row.role}>
                      <button
                        type="button"
                        className="grid w-full cursor-default grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_3.25rem] items-center gap-x-3 rounded-md py-0.5 text-left text-sm calm-transition hover:bg-neutral-950/[0.04] sm:grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)_3.5rem]"
                        onMouseEnter={(e) =>
                          showTip(
                            e,
                            `${row.label}\n${row.count.toLocaleString()} observation${row.count === 1 ? "" : "s"}`,
                          )
                        }
                        onMouseMove={moveTip}
                        onMouseLeave={hideTip}
                      >
                        <span className="min-w-0 truncate font-semibold text-[#111827]" title={row.label}>
                          {row.label}
                        </span>
                        <div className={barTrack}>
                          <span
                            className="pointer-events-none absolute inset-y-0 left-0 rounded-sm"
                            style={{
                              width: `${pct}%`,
                              minWidth: row.count > 0 ? "0.5rem" : 0,
                              background: barBg,
                            }}
                          />
                        </div>
                        <span
                          className={`text-right text-[0.8125rem] font-semibold tabular-nums ${
                            isLead ? "text-neutral-950" : "text-[#6B7280]"
                          }`}
                        >
                          {row.count.toLocaleString()}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-auto pt-5 text-[0.6875rem] text-[#6B7280]">
                <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-sm align-middle bg-neutral-950" />{" "}
                Total observations
              </p>
            </>
          )}
        </div>

        <div className={`${analysisCardClass} flex flex-col p-5 md:p-6`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-text">
                  Observations over time
                </h3>
                <InfoCircleIcon
                  title={
                    timelineSeriesMode === "weekly"
                      ? "Weekly counts in the chart window. Use the menu to switch to cumulative total or a 4-week rolling average."
                      : timelineSeriesMode === "cumulative"
                        ? "Running total of observations from the start of the window through each week. Switch the menu to compare with per-week counts."
                        : "Smoothed trend: average weekly observations over this week and the three prior weeks (fewer weeks at the start of the range)."
                  }
                />
              </div>
              <p className="mt-1 text-[0.8125rem] text-[#6B7280]">
                {timelineSeriesMode === "weekly"
                  ? "Move along the chart: the guide follows the line and the tooltip shows counts for that week."
                  : timelineSeriesMode === "cumulative"
                    ? "The line shows how total observations build across the selected window."
                    : "Useful for spotting sustained pace without week-to-week noise."}
              </p>
            </div>
            <div className="relative shrink-0 self-start">
              <select
                id="obs-history-timeline-series"
                value={timelineSeriesMode}
                onChange={(e) => setTimelineSeriesMode(e.target.value as TimelineSeriesMode)}
                className="h-10 min-w-[11.5rem] max-w-[16rem] appearance-none rounded-lg border border-[#E5E7EB] bg-[var(--surface-container-lowest)] py-2 pl-3 pr-9 text-[0.75rem] font-semibold text-[#111827] shadow-sm outline-none calm-transition hover:border-[#D1D5DB] focus:border-[#CBD5E1] focus:ring-2 focus:ring-[rgba(15,23,42,0.06)]"
                aria-label="Observations over time: series type"
              >
                <option value="weekly">Observations per week</option>
                <option value="cumulative">Cumulative total</option>
                <option value="moving_avg">4-week rolling average</option>
              </select>
              <ChevronDownMini className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9CA3AF]" />
            </div>
          </div>
          {!hasTimeline ? (
            <p className="mt-4 text-sm text-muted">No weeks in range.</p>
          ) : (
            (() => {
              const { padL, padT, plotW, plotH, pts, snapIdx, segmentD, hoverX } = timelineSvgPlot;
              return (
                <div className="mt-4 w-full flex-1 overflow-x-auto rounded-md border border-[#E5E7EB] bg-[#F9FAFB] p-4">
                  <svg
                    viewBox={`0 0 ${linePoints.w} ${linePoints.h}`}
                    className="h-48 w-full min-w-[280px] cursor-crosshair calm-transition"
                    preserveAspectRatio="xMidYMid meet"
                    role="img"
                    aria-label={
                      timelineSeriesMode === "weekly"
                        ? "Observations per week line chart"
                        : timelineSeriesMode === "cumulative"
                          ? "Cumulative observations line chart"
                          : "Four-week rolling average observations line chart"
                    }
                    onMouseMove={handleTimelineSvgMove}
                    onMouseLeave={handleTimelineSvgLeave}
                  >
                    <defs>
                      <linearGradient id={`${chartSvgId}-fill`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={OBS_CHART_INK} stopOpacity="0.14" />
                        <stop offset="55%" stopColor={OBS_CHART_INK} stopOpacity="0.06" />
                        <stop offset="100%" stopColor={OBS_CHART_INK} stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <rect
                      x={padL}
                      y={padT}
                      width={plotW}
                      height={plotH}
                      rx="2"
                      fill="#FFFFFF"
                      opacity="0.55"
                      className="pointer-events-none"
                    />
                    {[0, 0.25, 0.5, 0.75, 1].map((t) => {
                      const y = padT + plotH * t;
                      const rawTick = maxTimeline * (1 - t);
                      const tickValue =
                        timelineSeriesMode === "moving_avg" && maxTimeline < 12
                          ? Math.round(rawTick * 10) / 10
                          : Math.round(rawTick);
                      return (
                        <g key={t}>
                          <text
                            x={padL - 8}
                            y={y + 4}
                            textAnchor="end"
                            className="pointer-events-none select-none"
                            fill="#9CA3AF"
                            fontSize="10"
                          >
                            {timelineSeriesMode === "moving_avg" && maxTimeline < 12
                              ? tickValue.toFixed(tickValue % 1 === 0 ? 0 : 1)
                              : tickValue}
                          </text>
                          <line
                            x1={padL}
                            x2={padL + plotW}
                            y1={y}
                            y2={y}
                            stroke="#E5E7EB"
                            strokeOpacity={t === 1 ? 0.9 : 1}
                            strokeWidth="1"
                            strokeDasharray={t === 1 ? undefined : "4 6"}
                            className="pointer-events-none"
                          />
                        </g>
                      );
                    })}
                    {(() => {
                      const n = pts.length;
                      if (n === 0) return null;
                      const maxXLabels = 8;
                      const step = n <= maxXLabels ? 1 : Math.ceil(n / maxXLabels);
                      return pts.map((p, i) => {
                        if (i !== n - 1 && i % step !== 0) return null;
                        return (
                          <text
                            key={`x-${p.weekKey}`}
                            x={p.x}
                            y={linePoints.h - 6}
                            textAnchor="middle"
                            className="pointer-events-none select-none"
                            fill="#9CA3AF"
                            fontSize="10"
                          >
                            {p.label}
                          </text>
                        );
                      });
                    })()}
                    <path
                      d={linePoints.fillD}
                      fill={`url(#${chartSvgId}-fill)`}
                      className="pointer-events-none calm-transition"
                    />
                    <path
                      d={linePoints.d}
                      fill="none"
                      stroke={OBS_CHART_INK}
                      strokeWidth="2.5"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      className="pointer-events-none calm-transition"
                      strokeOpacity={snapIdx !== null ? 0.22 : 1}
                    />
                    {segmentD ? (
                      <path
                        d={segmentD}
                        fill="none"
                        stroke={OBS_CHART_INK}
                        strokeWidth="3"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        className="pointer-events-none calm-transition"
                        strokeOpacity={1}
                      />
                    ) : null}
                    {hoverX != null ? (
                      <line
                        x1={hoverX}
                        x2={hoverX}
                        y1={padT}
                        y2={padT + plotH}
                        stroke={OBS_CHART_INK}
                        strokeOpacity={0.28}
                        strokeWidth="1"
                        className="pointer-events-none"
                      />
                    ) : null}
                    {pts.map((p, i) => {
                      const active = snapIdx === i;
                      const dim = snapIdx !== null && !active;
                      return (
                        <g key={p.weekKey} className="pointer-events-none calm-transition">
                          <circle
                            cx={p.x}
                            cy={p.y}
                            r={active ? 7.5 : 5}
                            fill="#FFFFFF"
                            stroke={OBS_CHART_INK}
                            strokeWidth={active ? 2.75 : 2}
                            opacity={dim ? 0.3 : 1}
                          />
                          {p.count > 0 ? (
                            <circle
                              cx={p.x}
                              cy={p.y}
                              r={active ? 3.25 : 2.25}
                              fill={OBS_CHART_INK}
                              opacity={dim ? 0.35 : 1}
                            />
                          ) : null}
                        </g>
                      );
                    })}
                    <rect
                      x={padL}
                      y={padT}
                      width={plotW}
                      height={plotH}
                      fill="transparent"
                      className="calm-transition"
                      style={{ touchAction: "none" }}
                    />
                  </svg>
                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.6875rem] text-[#6B7280]">
                    <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke={OBS_CHART_INK} strokeWidth="2" aria-hidden>
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
                    </svg>
                    {chartTimelineWeeks.length <= 8
                      ? chartTimelineWeeks.map((w) => (
                          <span key={w.weekKey} className="tabular-nums">
                            {w.label}:{" "}
                            <span className="font-semibold text-text">
                              {formatChartCount(timelineSeriesMode, w.count)}
                            </span>
                          </span>
                        ))
                      : (
                        <span>
                          <span className="tabular-nums text-text">{chartTimelineWeeks[0]?.label}</span>
                          {" "}
                          <span className="text-[#9CA3AF]">–</span>
                          {" "}
                          <span className="tabular-nums text-text">
                            {chartTimelineWeeks[chartTimelineWeeks.length - 1]?.label}
                          </span>
                          {" "}
                          <span className="font-bold tabular-nums" style={{ color: OBS_CHART_INK }}>
                            {timelineSeriesMode === "weekly"
                              ? rawObservationsInWindow.toLocaleString()
                              : formatChartCount(
                                  timelineSeriesMode,
                                  chartTimelineWeeks[chartTimelineWeeks.length - 1]?.count ?? 0,
                                )}
                          </span>{" "}
                          {timelineSeriesMode === "weekly"
                            ? "total in window"
                            : timelineSeriesMode === "cumulative"
                              ? "cumulative (end of range)"
                              : (
                                <>
                                  latest 4-wk avg ·{" "}
                                  <span className="font-semibold text-text">
                                    {rawObservationsInWindow.toLocaleString()}
                                  </span>{" "}
                                  obs. total
                                </>
                                )}
                        </span>
                      )}
                  </div>
                </div>
              );
            })()
          )}
        </div>
      </div>

      {showCoachingSection ? (
        <div className={`${analysisCardClass} p-5 md:p-6`}>
            <h3 className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-text">
              Coaching pairs — weekly coverage
            </h3>
            <p className="mt-1 max-w-3xl text-[0.8125rem] text-[#6B7280]">
              Black squares mark a week with at least one observation where this coach observed this coachee. Light grey
              weeks have none. Hover for the observation date; click a black square to open details.
            </p>
            {coachingCoachFilterOptions.length > 0 || coachingCoacheeFilterOptions.length > 0 ? (
              <CoachingPairFilterForm
                historyFilterQueryString={historyFilterQueryString}
                coachOptions={coachingCoachFilterOptions}
                coacheeOptions={coachingCoacheeFilterOptions}
                coachId={coachingCoachId}
                coacheeId={coachingCoacheeId}
              />
            ) : null}
            {pairWeekly.length === 0 ? (
              <p className="mt-4 text-sm text-muted">
                {coachingCoachId || coachingCoacheeId
                  ? "No coaching pairs match these people."
                  : "No coaching assignments in this school."}
              </p>
            ) : (
              <>
              <div className="obs-history-table-shell table-shell mt-4">
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead>
                      <tr className="table-head-row text-left">
                        <th className="px-5 py-3.5">Pair</th>
                        <th className="px-4 py-3.5 whitespace-nowrap">
                          <span className="inline-flex flex-col gap-0.5">
                            <span>Coaching obs.</span>
                            <span className="text-[0.625rem] font-normal normal-case tracking-normal text-muted">
                              in this period
                            </span>
                          </span>
                        </th>
                        <th className="px-4 py-3.5 whitespace-nowrap">Weeks with obs.</th>
                        <th className="w-full min-w-[240px] px-4 py-3.5 whitespace-nowrap">Weeks (oldest → newest)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pairWeekly.map((p) => (
                        <tr key={`${p.coachId}-${p.coacheeId}`} className="group table-row calm-transition">
                          <td className="px-5 py-4">
                            <span className="font-semibold text-text">{p.coachName}</span>
                            <span className="text-muted"> → </span>
                            <span className="font-semibold text-text">{p.coacheeName}</span>
                          </td>
                          <td className="px-4 py-4 tabular-nums text-muted">
                            <span title="Observations where this coach was the observer and this teacher was observed, within the chart period above (and your other filters).">
                              {p.observationCount}
                            </span>
                          </td>
                          <td className="px-4 py-4 tabular-nums text-muted">
                            {p.weeksWithObservation} / {p.weekHit.length}
                          </td>
                          <td className="w-full px-4 py-4">
                            <div className="flex w-full flex-wrap gap-0.5">
                              {p.weekHit.map((hit, i) => {
                                const obsId = p.weekObservationIds[i];
                                const iso = p.weekObservationDates[i];
                                const weekLbl = p.weekLabels[i] ?? "";
                                if (hit && obsId && iso) {
                                  return (
                                    <Link
                                      key={i}
                                      href={`/observe/${obsId}`}
                                      className="inline-flex h-2.5 w-2.5 shrink-0 items-center justify-center rounded-sm bg-[var(--obs-coaching-hit)] calm-transition hover:ring-2 hover:ring-neutral-950/25 hover:ring-offset-1 hover:ring-offset-surface-container-lowest"
                                      title={`Observation ${formatObsDate(iso)} — click for details`}
                                      onMouseEnter={(e) =>
                                        showTip(e, `Observation\n${formatObsDate(iso)}\nClick to open`)
                                      }
                                      onMouseMove={moveTip}
                                      onMouseLeave={hideTip}
                                    />
                                  );
                                }
                                return (
                                  <span
                                    key={i}
                                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm bg-[var(--obs-coaching-miss)]"
                                    title={`${weekLbl}: no observation`}
                                    onMouseEnter={(e) => showTip(e, `${weekLbl}\nNo observation`)}
                                    onMouseMove={moveTip}
                                    onMouseLeave={hideTip}
                                  />
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="md:hidden divide-y divide-border/20">
                  {pairWeekly.map((p) => (
                    <div key={`${p.coachId}-${p.coacheeId}`} className="px-4 py-3.5">
                      <p className="text-[0.875rem] font-semibold text-text">
                        {p.coachName} <span className="font-normal text-muted">→</span> {p.coacheeName}
                      </p>
                      <p className="mt-1 text-[0.8125rem] text-muted">
                        {p.observationCount} coaching observation{p.observationCount === 1 ? "" : "s"} this period ·{" "}
                        {p.weeksWithObservation}/{p.weekHit.length} weeks with obs.
                      </p>
                      <div className="mt-2 flex flex-wrap gap-0.5">
                        {p.weekHit.map((hit, i) => {
                          const obsId = p.weekObservationIds[i];
                          const iso = p.weekObservationDates[i];
                          const weekLbl = p.weekLabels[i] ?? "";
                          if (hit && obsId && iso) {
                            return (
                              <Link
                                key={i}
                                href={`/observe/${obsId}`}
                                className="inline-flex h-2.5 w-2.5 shrink-0 items-center justify-center rounded-sm bg-[var(--obs-coaching-hit)]"
                                title={`Observation ${formatObsDate(iso)}`}
                              />
                            );
                          }
                          return (
                            <span
                              key={i}
                              className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm bg-[var(--obs-coaching-miss)]"
                              title={`${weekLbl}: no observation`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-3 border-t border-border/25 pt-4 text-[0.8125rem] text-muted sm:flex-row sm:items-center sm:justify-between">
                <div className="inline-flex items-center gap-2">
                  <CalendarOutlineIcon className="h-4 w-4 shrink-0" stroke="currentColor" />
                  <span>
                    Window: <span className="font-semibold text-text">{rangeLabel}</span>
                    {pairWeekly[0]?.weekHit.length ? (
                      <span className="text-muted"> ({pairWeekly[0].weekHit.length} weeks)</span>
                    ) : null}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm bg-[var(--obs-coaching-miss)]" aria-hidden />
                    No observation
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm bg-[var(--obs-coaching-hit)]" aria-hidden />
                    Observed
                  </span>
                </div>
              </div>
              </>
            )}
        </div>
      ) : null}
    </section>
  );
}
