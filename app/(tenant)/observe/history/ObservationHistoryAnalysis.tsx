"use client";

import { useMemo } from "react";

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
};

export type TimelineWeekSerialized = { weekKey: string; label: string; count: number };

type Props = {
  rangeLabel: string;
  roleCounts: RoleCountSerialized[];
  pairWeekly: PairWeeklySerialized[];
  timelineWeeks: TimelineWeekSerialized[];
  showCoachingSection: boolean;
};

function barWidthPct(count: number, max: number): number {
  if (max === 0) return 0;
  return Math.round((count / max) * 100);
}

export function ObservationHistoryAnalysis({
  rangeLabel,
  roleCounts,
  pairWeekly,
  timelineWeeks,
  showCoachingSection,
}: Props) {
  const maxRole = useMemo(() => Math.max(...roleCounts.map((r) => r.count), 1), [roleCounts]);
  const maxTimeline = useMemo(
    () => Math.max(...timelineWeeks.map((w) => w.count), 1),
    [timelineWeeks],
  );

  const linePoints = useMemo(() => {
    const n = timelineWeeks.length;
    if (n === 0) return { d: "", fillD: "", points: [] as { x: number; y: number; label: string; count: number }[] };
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
      return { x, y, label: row.label, count: row.count };
    });
    const lineD = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    const fillD = `${lineD} L ${pts[pts.length - 1].x.toFixed(1)} ${(padT + innerH).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(padT + innerH).toFixed(1)} Z`;
    return { d: lineD, fillD, points: pts, w, h, padB };
  }, [timelineWeeks, maxTimeline]);

  const barTrack =
    "relative h-7 min-w-0 flex-1 overflow-hidden rounded-xl bg-[var(--surface-container-high)] calm-transition";
  const barFillClass =
    "pointer-events-none absolute inset-y-0 left-0 rounded-xl border-r border-[rgba(99,102,241,0.28)] bg-[rgba(99,102,241,0.22)]";

  const hasRoles = roleCounts.some((r) => r.count > 0);
  const hasTimeline = timelineWeeks.length > 0;

  return (
    <section className="rounded-2xl border border-border/30 bg-surface-container-lowest shadow-ambient">
      <div className="border-b border-border/20 px-5 py-4 md:px-6">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">Analysis</p>
        <p className="mt-1 text-[0.8125rem] text-muted">
          Same scope as the table below (filters applied). Timeline uses weeks starting Monday.{" "}
          <span className="text-text/90">{rangeLabel}</span>
        </p>
      </div>

      <div className="grid gap-8 p-5 md:grid-cols-2 md:gap-10 md:p-6 lg:grid-cols-12">
        {/* Observer role counts */}
        <div className="md:col-span-2 lg:col-span-4">
          <h3 className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
            Observations by observer role
          </h3>
          <p className="mt-1 text-[0.8125rem] text-muted">Count of observations where the observer holds each role.</p>
          {!hasRoles ? (
            <p className="mt-4 text-sm text-muted">No observations in the current filter.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {roleCounts.map((row) => (
                <li key={row.role} className="flex items-center gap-3 text-sm">
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
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Timeline */}
        <div className="md:col-span-2 lg:col-span-8">
          <h3 className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
            Observations over time
          </h3>
          <p className="mt-1 text-[0.8125rem] text-muted">
            Weekly totals so you can spot increases and drop-offs.
          </p>
          {!hasTimeline ? (
            <p className="mt-4 text-sm text-muted">No weeks in range.</p>
          ) : (
            <div className="mt-4 w-full overflow-x-auto">
              <svg
                viewBox={`0 0 ${linePoints.w} ${linePoints.h}`}
                className="h-44 w-full min-w-[280px] text-accent"
                preserveAspectRatio="xMidYMid meet"
                role="img"
                aria-label="Observations per week line chart"
              >
                <defs>
                  <linearGradient id="obsHistoryFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgb(99 102 241)" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="rgb(99 102 241)" stopOpacity="0.02" />
                  </linearGradient>
                </defs>
                <path d={linePoints.fillD} fill="url(#obsHistoryFill)" className="calm-transition" />
                <path
                  d={linePoints.d}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  className="calm-transition"
                />
                {linePoints.points.map((p, i) => (
                  <g key={i}>
                    <title>{`${p.label}: ${p.count} observation${p.count === 1 ? "" : "s"}`}</title>
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r="4"
                      fill="currentColor"
                      stroke="var(--surface-container-lowest)"
                      strokeWidth="2"
                    />
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
                      total in range
                    </span>
                  )}
              </div>
            </div>
          )}
        </div>

        {/* Coaching pairs */}
        {showCoachingSection && (
          <div className="md:col-span-2 lg:col-span-12">
            <h3 className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
              Coaching pairs — weekly coverage
            </h3>
            <p className="mt-1 max-w-3xl text-[0.8125rem] text-muted">
              Each row is an assigned coach and coachee. A green cell means at least one observation that week with that
              coach observing that coachee. Aim for consistent green across weeks (weekly rhythm).
            </p>
            {pairWeekly.length === 0 ? (
              <p className="mt-4 text-sm text-muted">No coaching assignments in this school.</p>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-xl border border-border/20">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border/20 bg-surface-container-low/80 text-[0.6875rem] uppercase tracking-[0.06em] text-muted">
                      <th className="px-3 py-2.5 font-semibold">Pair</th>
                      <th className="px-3 py-2.5 font-semibold whitespace-nowrap">In range</th>
                      <th className="px-3 py-2.5 font-semibold whitespace-nowrap">Weeks with obs.</th>
                      <th className="min-w-[240px] px-3 py-2.5 font-semibold">Weeks (oldest → newest)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/15">
                    {pairWeekly.map((p) => (
                      <tr key={`${p.coachId}-${p.coacheeId}`} className="calm-transition hover:bg-accent/[0.03]">
                        <td className="px-3 py-2.5">
                          <span className="font-medium text-text">{p.coachName}</span>
                          <span className="text-muted"> → </span>
                          <span className="font-medium text-text">{p.coacheeName}</span>
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-muted">{p.observationCount}</td>
                        <td className="px-3 py-2.5 tabular-nums text-muted">
                          {p.weeksWithObservation} / {p.weekHit.length}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-wrap gap-0.5" title={p.weekLabels.join(", ")}>
                            {p.weekHit.map((hit, i) => (
                              <span
                                key={i}
                                className={`inline-block h-3 w-3 shrink-0 rounded-sm ${
                                  hit ? "bg-[var(--scale-strong-bar)]" : "bg-[var(--surface-container-high)]"
                                }`}
                                title={`${p.weekLabels[i] ?? ""}: ${hit ? "observed" : "no observation"}`}
                              />
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
