"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  "26w": { label: "~26 weeks", short: "26 wks" },
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

  return (
    <div
      ref={ref}
      className="pointer-events-none fixed z-[100] max-w-[min(280px,calc(100vw-1.5rem))] rounded-lg border border-border/40 bg-surface-container-lowest/95 px-3 py-2 text-[0.8125rem] shadow-lg backdrop-blur-sm"
      style={{
        left: pos?.left ?? state.x + TOOLTIP_GAP,
        top: pos?.top ?? state.y + TOOLTIP_GAP,
        visibility: pos ? "visible" : "hidden",
      }}
      role="tooltip"
    >
      <span className="whitespace-pre-wrap text-text">{state.text}</span>
    </div>
  );
}

/** Plot area inside the timeline SVG (must match line chart geometry). */
const TIMELINE_PAD = { L: 36, R: 8, T: 12, B: 28, W: 640, H: 160 };

const CHART_VIOLET = "#7C69EF";
const CHART_VIOLET_SOFT = "rgba(124, 105, 239, 0.14)";
const CHART_VIOLET_TINT = "rgba(124, 105, 239, 0.12)";

function SectionIconBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[color:var(--info)]"
      style={{ backgroundColor: CHART_VIOLET_TINT }}
    >
      {children}
    </div>
  );
}

function InfoCircleIcon({ title: ariaLabel }: { title: string }) {
  return (
    <span
      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-border/50 text-[0.625rem] font-semibold leading-none text-muted"
      title={ariaLabel}
      aria-label={ariaLabel}
    >
      i
    </span>
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
  const triggerWhite = "!bg-surface-container-lowest rounded-[10px]";

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
  const maxTimeline = useMemo(
    () => Math.max(...timelineWeeks.map((w) => w.count), 1),
    [timelineWeeks],
  );

  const linePoints = useMemo(() => {
    const n = timelineWeeks.length;
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
    const pts = timelineWeeks.map((row, i) => {
      const x = padL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
      const y = padT + innerH - (row.count / maxTimeline) * innerH;
      return { x, y, label: row.label, count: row.count, weekKey: row.weekKey };
    });
    const lineD = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    const fillD = `${lineD} L ${pts[pts.length - 1].x.toFixed(1)} ${(padT + innerH).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(padT + innerH).toFixed(1)} Z`;
    return { d: lineD, fillD, points: pts, w, h, padL, padR, padT, padB };
  }, [timelineWeeks, maxTimeline]);

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
  }, [linePoints.d, cancelTimelineRaf]);

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
        text: `Week of ${p.label}\n${p.count.toLocaleString()} observation${p.count === 1 ? "" : "s"}`,
      });
    },
    [linePoints.points, cancelTimelineRaf, scheduleTimelineSmoothing],
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
    "relative h-8 min-w-0 w-full overflow-hidden rounded-full bg-[var(--surface-container-high)] calm-transition";

  const hasRoles = roleCounts.some((r) => r.count > 0);
  const hasTimeline = timelineWeeks.length > 0;

  const analysisCardClass =
    "rounded-[14px] border border-border/30 bg-surface-container-lowest shadow-ambient";

  return (
    <section className="space-y-5" onMouseLeave={hideTip}>
      <ChartTooltip state={tip} />

      <div className={`${analysisCardClass} px-5 py-5 md:px-6`}>
        <div className="flex items-start gap-3">
          <SectionIconBox>
            <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M4 19V5" strokeLinecap="round" />
              <path d="M4 14h4l3-8 4 12 3-6h6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </SectionIconBox>
          <div className="min-w-0 flex-1">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">Analysis</p>
            <p className="mt-1 text-[0.8125rem] text-muted">
              Charts use the same filters as the table. When you set table date filters, the chart window is the overlap
              with the range you pick below (UK academic year: 1 Sep – 31 Aug). Weeks start on Monday.
            </p>
            <p className="mt-2 text-[0.8125rem] text-muted">
              <span>Current window: </span>
              <span className="font-semibold" style={{ color: CHART_VIOLET }}>
                {rangeLabel}
              </span>
            </p>
            {emptyIntersection ? (
              <p className="mt-2 rounded-lg border border-scale-some/30 bg-scale-some-light/80 px-3 py-2 text-[0.8125rem] text-text">
                {chartFellBackToTableDates
                  ? "The chart range you picked does not overlap your table date filters, so the charts below use your table date range instead. Widen the table dates or choose another chart range."
                  : "No overlap between this chart range and your table date filters — widen dates or pick another range."}
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              {OBSERVATION_ANALYSIS_PRESETS.map((preset) => {
                const active = analysisPreset === preset;
                return (
                  <Link
                    key={preset}
                    href={analysisHref(preset, historyFilterQueryString)}
                    className={`inline-flex items-center rounded-full px-3.5 py-1.5 text-[0.75rem] font-semibold calm-transition ${
                      active
                        ? "text-white shadow-sm"
                        : "border border-border/40 bg-surface-container-lowest text-muted hover:border-border hover:text-text"
                    }`}
                    style={active ? { backgroundColor: CHART_VIOLET } : undefined}
                  >
                    {PRESET_META[preset].short}
                  </Link>
                );
              })}
            </div>
            <p className="mt-2 text-[0.6875rem] text-muted">
              {PRESET_META.week.label} (7 days) · {PRESET_META.month.label} (30 days) ·{" "}
              {PRESET_META.academic_year.label} · {PRESET_META["26w"].label}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.38fr)_minmax(0,1fr)] lg:items-stretch">
        <div className={`${analysisCardClass} flex flex-col p-5 md:p-6`}>
          <div className="flex items-start gap-3">
            <SectionIconBox>
              <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeLinecap="round" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" />
              </svg>
            </SectionIconBox>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
                  Observations by observer role
                </h3>
                <InfoCircleIcon title="Counts reflect observers in your current table filters and the chart window above." />
              </div>
              <p className="mt-1 text-[0.8125rem] text-muted">Hover a bar for the exact count.</p>
            </div>
          </div>
          {!hasRoles ? (
            <p className="mt-4 text-sm text-muted">No observations in the current filter.</p>
          ) : (
            <>
              <ul className="mt-4 space-y-3">
                {roleCounts.map((row) => (
                  <li key={row.role}>
                    <button
                      type="button"
                      className="flex w-full cursor-default items-center gap-3 rounded-lg py-0.5 text-left text-sm calm-transition hover:bg-[rgba(124,105,239,0.06)]"
                      onMouseEnter={(e) =>
                        showTip(
                          e,
                          `${row.label}\n${row.count.toLocaleString()} observation${row.count === 1 ? "" : "s"}`,
                        )
                      }
                      onMouseMove={moveTip}
                      onMouseLeave={hideTip}
                    >
                      <span className="w-[7.5rem] shrink-0 truncate font-semibold text-text" title={row.label}>
                        {row.label}
                      </span>
                      <div className="flex min-w-0 flex-1 items-center gap-2.5">
                        <div className={barTrack}>
                          <span
                            className="pointer-events-none absolute inset-y-0 left-0 rounded-full"
                            style={{
                              width: `${barWidthPct(row.count, maxRole)}%`,
                              background: `linear-gradient(90deg, ${CHART_VIOLET} 0%, ${CHART_VIOLET_SOFT} 88%, transparent 100%)`,
                            }}
                          />
                        </div>
                        <span
                          className="min-w-[2.75rem] shrink-0 text-right text-[0.8125rem] font-semibold tabular-nums"
                          style={{ color: CHART_VIOLET }}
                        >
                          {row.count.toLocaleString()}
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-auto pt-5 text-[0.6875rem] text-muted">
                <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ backgroundColor: CHART_VIOLET }} />{" "}
                Total observations
              </p>
            </>
          )}
        </div>

        <div className={`${analysisCardClass} flex flex-col p-5 md:p-6`}>
          <div className="flex items-start gap-3">
            <SectionIconBox>
              <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M4 19V5" strokeLinecap="round" />
                <path d="M4 14h4l3-8 4 12 3-6h6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </SectionIconBox>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
                  Observations over time
                </h3>
                <InfoCircleIcon title="Weekly counts within the chart window; move the pointer along the line to inspect each week." />
              </div>
              <p className="mt-1 text-[0.8125rem] text-muted">
                Move along the chart: the guide glides along the line and the tooltip stays by your cursor.
              </p>
            </div>
          </div>
          {!hasTimeline ? (
            <p className="mt-4 text-sm text-muted">No weeks in range.</p>
          ) : (
            (() => {
              const { padL, padT, plotW, plotH, pts, snapIdx, segmentD, hoverX } = timelineSvgPlot;
              return (
                <div className="mt-4 w-full flex-1 overflow-x-auto rounded-[12px] border border-border/25 bg-gradient-to-b from-[rgba(124,105,239,0.06)] to-transparent p-4">
                  <svg
                    viewBox={`0 0 ${linePoints.w} ${linePoints.h}`}
                    className="h-48 w-full min-w-[280px] cursor-crosshair calm-transition"
                    preserveAspectRatio="xMidYMid meet"
                    role="img"
                    aria-label="Observations per week line chart"
                    onMouseMove={handleTimelineSvgMove}
                    onMouseLeave={handleTimelineSvgLeave}
                  >
                    <defs>
                      <linearGradient id={`${chartSvgId}-fill`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CHART_VIOLET} stopOpacity="0.35" />
                        <stop offset="50%" stopColor={CHART_VIOLET} stopOpacity="0.12" />
                        <stop offset="100%" stopColor={CHART_VIOLET} stopOpacity="0" />
                      </linearGradient>
                      <linearGradient id={`${chartSvgId}-stroke`} x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={CHART_VIOLET} />
                        <stop offset="100%" stopColor="#B8A9F5" />
                      </linearGradient>
                      <filter id={`${chartSvgId}-glow`} x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="1.2" result="blur" />
                        <feMerge>
                          <feMergeNode in="blur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>
                    <rect
                      x={padL}
                      y={padT}
                      width={plotW}
                      height={plotH}
                      rx="10"
                      fill="var(--surface-container-lowest)"
                      opacity="0.65"
                      className="pointer-events-none"
                    />
                    {[0, 0.25, 0.5, 0.75, 1].map((t) => {
                      const y = padT + plotH * t;
                      const tickValue = Math.round(maxTimeline * (1 - t));
                      return (
                        <g key={t}>
                          <text
                            x={padL - 8}
                            y={y + 4}
                            textAnchor="end"
                            className="pointer-events-none select-none"
                            fill="var(--on-surface-variant)"
                            fontSize="10"
                          >
                            {tickValue}
                          </text>
                          <line
                            x1={padL}
                            x2={padL + plotW}
                            y1={y}
                            y2={y}
                            stroke="var(--border)"
                            strokeOpacity={t === 1 ? 0.35 : 0.2}
                            strokeWidth="1"
                            strokeDasharray={t === 1 ? undefined : "4 6"}
                            className="pointer-events-none"
                          />
                        </g>
                      );
                    })}
                    <path
                      d={linePoints.fillD}
                      fill={`url(#${chartSvgId}-fill)`}
                      className="pointer-events-none calm-transition"
                    />
                    <path
                      d={linePoints.d}
                      fill="none"
                      stroke={`url(#${chartSvgId}-stroke)`}
                      strokeWidth="2.5"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      filter={`url(#${chartSvgId}-glow)`}
                      className="pointer-events-none calm-transition"
                      strokeOpacity={snapIdx !== null ? 0.22 : 1}
                    />
                    {segmentD ? (
                      <path
                        d={segmentD}
                        fill="none"
                        stroke={`url(#${chartSvgId}-stroke)`}
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
                        stroke={CHART_VIOLET}
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
                            fill="var(--surface-container-lowest)"
                            stroke={CHART_VIOLET}
                            strokeWidth={active ? 2.75 : 2}
                            opacity={dim ? 0.3 : 1}
                          />
                          {p.count > 0 ? (
                            <circle
                              cx={p.x}
                              cy={p.y}
                              r={active ? 3.25 : 2.25}
                              fill={CHART_VIOLET}
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
                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.6875rem] text-muted">
                    <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke={CHART_VIOLET} strokeWidth="2" aria-hidden>
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
                    </svg>
                    {timelineWeeks.length <= 8
                      ? timelineWeeks.map((w) => (
                          <span key={w.weekKey} className="tabular-nums">
                            {w.label}: <span className="font-semibold text-text">{w.count}</span>
                          </span>
                        ))
                      : (
                        <span>
                          {timelineWeeks[0]?.label} … {timelineWeeks[timelineWeeks.length - 1]?.label}{" "}
                          <span className="font-semibold" style={{ color: CHART_VIOLET }}>
                            {timelineWeeks.reduce((s, w) => s + w.count, 0).toLocaleString()}
                          </span>{" "}
                          total in window
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
            <h3 className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
              Coaching pairs — weekly coverage
            </h3>
            <p className="mt-1 max-w-3xl text-[0.8125rem] text-muted">
              Green weeks had at least one observation with this coach observing this coachee. Hover for the observation
              date; click to open details.
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
              <div className="table-shell mt-4">
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
                        <th className="min-w-[240px] px-4 py-3.5">Weeks (oldest → newest)</th>
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
                          <td className="px-4 py-4">
                            <div className="flex flex-wrap gap-1">
                              {p.weekHit.map((hit, i) => {
                                const obsId = p.weekObservationIds[i];
                                const iso = p.weekObservationDates[i];
                                const weekLbl = p.weekLabels[i] ?? "";
                                if (hit && obsId && iso) {
                                  return (
                                    <Link
                                      key={i}
                                      href={`/observe/${obsId}`}
                                      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-[var(--scale-strong-bar)] calm-transition hover:ring-2 hover:ring-accent/40 hover:ring-offset-1 hover:ring-offset-surface-container-lowest"
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
                                    className="inline-block h-4 w-4 shrink-0 rounded-sm bg-[var(--surface-container-high)]"
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
                      <div className="mt-2 flex flex-wrap gap-1">
                        {p.weekHit.map((hit, i) => {
                          const obsId = p.weekObservationIds[i];
                          const iso = p.weekObservationDates[i];
                          const weekLbl = p.weekLabels[i] ?? "";
                          if (hit && obsId && iso) {
                            return (
                              <Link
                                key={i}
                                href={`/observe/${obsId}`}
                                className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-[var(--scale-strong-bar)]"
                                title={`Observation ${formatObsDate(iso)}`}
                              />
                            );
                          }
                          return (
                            <span
                              key={i}
                              className="inline-block h-4 w-4 shrink-0 rounded-sm bg-[var(--surface-container-high)]"
                              title={`${weekLbl}: no observation`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
        </div>
      ) : null}
    </section>
  );
}
