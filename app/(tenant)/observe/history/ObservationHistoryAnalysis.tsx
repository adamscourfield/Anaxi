"use client";

import Link from "next/link";
import { useCallback, useId, useMemo, useRef, useState } from "react";
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

function ChartTooltip({ state }: { state: TooltipState }) {
  if (!state) return null;
  return (
    <div
      className="pointer-events-none fixed z-[100] max-w-[min(280px,calc(100vw-1.5rem))] rounded-lg border border-border/40 bg-surface-container-lowest px-3 py-2 text-[0.8125rem] shadow-lg"
      style={{
        left: state.x + 12,
        top: state.y + 12,
        transform: "translate(0, 0)",
      }}
      role="tooltip"
    >
      <span className="whitespace-pre-wrap text-text">{state.text}</span>
    </div>
  );
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
  const chartSvgId = useId().replace(/[^a-zA-Z0-9_-]/g, "_");

  const showTip = useCallback((e: React.MouseEvent, text: string) => {
    setTip({ x: e.clientX, y: e.clientY, text });
  }, []);

  const moveTip = useCallback((e: React.MouseEvent) => {
    setTip((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : null));
  }, []);

  const hideTip = useCallback(() => setTip(null), []);

  const maxRole = useMemo(() => Math.max(...roleCounts.map((r) => r.count), 1), [roleCounts]);
  const maxTimeline = useMemo(
    () => Math.max(...timelineWeeks.map((w) => w.count), 1),
    [timelineWeeks],
  );

  const linePoints = useMemo(() => {
    const n = timelineWeeks.length;
    if (n === 0) {
      return {
        d: "",
        fillD: "",
        points: [] as { x: number; y: number; label: string; count: number; weekKey: string }[],
        w: 640,
        h: 160,
      };
    }
    const w = 640;
    const h = 160;
    const padL = 8;
    const padR = 8;
    const padT = 12;
    const padB = 28;
    const innerW = w - padL - padR;
    const innerH = h - padT - padB;
    const pts = timelineWeeks.map((row, i) => {
      const x = padL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
      const y = padT + innerH - (row.count / maxTimeline) * innerH;
      return { x, y, label: row.label, count: row.count, weekKey: row.weekKey };
    });
    const lineD = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    const fillD = `${lineD} L ${pts[pts.length - 1].x.toFixed(1)} ${(padT + innerH).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(padT + innerH).toFixed(1)} Z`;
    return { d: lineD, fillD, points: pts, w, h };
  }, [timelineWeeks, maxTimeline]);

  const barTrack =
    "relative h-7 min-w-0 flex-1 overflow-hidden rounded-xl bg-[var(--surface-container-high)] calm-transition";
  const barFillClass =
    "pointer-events-none absolute inset-y-0 left-0 rounded-xl border-r border-[rgba(99,102,241,0.28)] bg-[rgba(99,102,241,0.22)]";

  const hasRoles = roleCounts.some((r) => r.count > 0);
  const hasTimeline = timelineWeeks.length > 0;

  return (
    <section
      className="rounded-2xl border border-border/30 bg-surface-container-lowest shadow-ambient"
      onMouseLeave={hideTip}
    >
      <ChartTooltip state={tip} />

      <div className="border-b border-border/20 px-5 py-4 md:px-6">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">Analysis</p>
        <p className="mt-1 text-[0.8125rem] text-muted">
          Charts use the same filters as the table. When you set table date filters, the chart window is the overlap
          with the range you pick below (UK academic year: 1 Sep – 31 Aug). Weeks start on Monday.
        </p>
        <p className="mt-2 text-[0.8125rem]">
          <span className="text-muted">Current window: </span>
          <span className="font-medium text-text">{rangeLabel}</span>
        </p>
        {emptyIntersection ? (
          <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[0.8125rem] text-text">
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
                    ? "bg-accent text-on-primary anx-card-elevated"
                    : "border border-border/40 bg-surface-container-low text-muted hover:border-border hover:text-text"
                }`}
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

      <div className="grid gap-8 p-5 md:grid-cols-2 md:gap-10 md:p-6 lg:grid-cols-12">
        <div className="md:col-span-2 lg:col-span-4">
          <h3 className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
            Observations by observer role
          </h3>
          <p className="mt-1 text-[0.8125rem] text-muted">Hover a bar for the exact count.</p>
          {!hasRoles ? (
            <p className="mt-4 text-sm text-muted">No observations in the current filter.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {roleCounts.map((row) => (
                <li key={row.role}>
                  <button
                    type="button"
                    className="flex w-full cursor-default items-center gap-3 rounded-lg py-0.5 text-left text-sm calm-transition hover:bg-accent/[0.04]"
                    onMouseEnter={(e) =>
                      showTip(
                        e,
                        `${row.label}\n${row.count.toLocaleString()} observation${row.count === 1 ? "" : "s"}`,
                      )
                    }
                    onMouseMove={moveTip}
                    onMouseLeave={hideTip}
                  >
                    <span className="w-[7.5rem] shrink-0 truncate font-medium text-text" title={row.label}>
                      {row.label}
                    </span>
                    <div className={barTrack}>
                      <span
                        className={barFillClass}
                        style={{ width: `${barWidthPct(row.count, maxRole)}%` }}
                      />
                      <span className="relative z-[1] flex h-full items-center px-2 text-[0.75rem] tabular-nums text-text">
                        {row.count.toLocaleString()}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="md:col-span-2 lg:col-span-8">
          <h3 className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
            Observations over time
          </h3>
          <p className="mt-1 text-[0.8125rem] text-muted">Hover a point for the count for that week.</p>
          {!hasTimeline ? (
            <p className="mt-4 text-sm text-muted">No weeks in range.</p>
          ) : (
            <div className="mt-4 w-full overflow-x-auto rounded-2xl border border-border/25 bg-gradient-to-b from-[var(--surface-container-high)]/40 to-transparent p-4">
              <svg
                viewBox={`0 0 ${linePoints.w} ${linePoints.h}`}
                className="h-48 w-full min-w-[280px] text-accent"
                preserveAspectRatio="xMidYMid meet"
                role="img"
                aria-label="Observations per week line chart"
              >
                <defs>
                  <linearGradient id={`${chartSvgId}-fill`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgb(99 102 241)" stopOpacity="0.28" />
                    <stop offset="55%" stopColor="rgb(99 102 241)" stopOpacity="0.08" />
                    <stop offset="100%" stopColor="rgb(99 102 241)" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id={`${chartSvgId}-stroke`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="rgb(129 140 248)" />
                    <stop offset="50%" stopColor="rgb(99 102 241)" />
                    <stop offset="100%" stopColor="rgb(79 70 229)" />
                  </linearGradient>
                  <filter id={`${chartSvgId}-glow`} x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="1.2" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                {/* Chart plot background */}
                <rect
                  x="8"
                  y="12"
                  width="624"
                  height="120"
                  rx="10"
                  fill="var(--surface-container-lowest)"
                  opacity="0.65"
                />
                {/* Horizontal grid */}
                {[0, 0.25, 0.5, 0.75, 1].map((t) => {
                  const y = 12 + 120 * t;
                  return (
                    <line
                      key={t}
                      x1="8"
                      x2="632"
                      y1={y}
                      y2={y}
                      stroke="var(--border)"
                      strokeOpacity={t === 1 ? 0.35 : 0.12}
                      strokeWidth="1"
                      strokeDasharray={t === 1 ? undefined : "4 6"}
                    />
                  );
                })}
                <path
                  d={linePoints.fillD}
                  fill={`url(#${chartSvgId}-fill)`}
                  className="calm-transition"
                />
                <path
                  d={linePoints.d}
                  fill="none"
                  stroke={`url(#${chartSvgId}-stroke)`}
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  filter={`url(#${chartSvgId}-glow)`}
                  className="calm-transition"
                />
                {linePoints.points.map((p) => (
                  <g key={p.weekKey}>
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r="14"
                      fill="transparent"
                      className="cursor-crosshair"
                      onMouseEnter={(e) => {
                        const el = e.currentTarget.ownerSVGElement;
                        if (!el) return;
                        const rect = el.getBoundingClientRect();
                        const vb = el.viewBox.baseVal;
                        const sx = rect.width / vb.width;
                        const sy = rect.height / vb.height;
                        const cx = rect.left + p.x * sx;
                        const cy = rect.top + p.y * sy;
                        setTip({
                          x: cx,
                          y: cy,
                          text: `Week of ${p.label}\n${p.count.toLocaleString()} observation${p.count === 1 ? "" : "s"}`,
                        });
                      }}
                      onMouseMove={(e) => {
                        const el = e.currentTarget.ownerSVGElement;
                        if (!el) return;
                        const rect = el.getBoundingClientRect();
                        const vb = el.viewBox.baseVal;
                        const sx = rect.width / vb.width;
                        const sy = rect.height / vb.height;
                        const cx = rect.left + p.x * sx;
                        const cy = rect.top + p.y * sy;
                        setTip((prev) =>
                          prev
                            ? {
                                ...prev,
                                x: cx,
                                y: cy,
                              }
                            : null,
                        );
                      }}
                      onMouseLeave={hideTip}
                    />
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r="5"
                      fill="var(--surface-container-lowest)"
                      stroke={`url(#${chartSvgId}-stroke)`}
                      strokeWidth="2"
                      className="pointer-events-none"
                    />
                    {p.count > 0 ? (
                      <circle cx={p.x} cy={p.y} r="2.25" fill="rgb(99 102 241)" className="pointer-events-none" />
                    ) : null}
                  </g>
                ))}
              </svg>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[0.6875rem] text-muted">
                {timelineWeeks.length <= 8
                  ? timelineWeeks.map((w) => (
                      <span key={w.weekKey} className="tabular-nums">
                        {w.label}: <span className="font-semibold text-text">{w.count}</span>
                      </span>
                    ))
                  : (
                    <span>
                      {timelineWeeks[0]?.label} … {timelineWeeks[timelineWeeks.length - 1]?.label} ·{" "}
                      <span className="font-semibold text-text">
                        {timelineWeeks.reduce((s, w) => s + w.count, 0).toLocaleString()}
                      </span>{" "}
                      total in window
                    </span>
                  )}
              </div>
            </div>
          )}
        </div>

        {showCoachingSection && (
          <div className="md:col-span-2 lg:col-span-12">
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
        )}
      </div>
    </section>
  );
}
