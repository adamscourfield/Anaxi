"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useMemo, useState } from "react";
import type { HeatmapCellIncident } from "@/modules/home/hydration";

export type { HeatmapCellIncident };

export type BehaviourHeatmapProps = {
  /**
   * Ordered list of year-group labels (rows), e.g. ["Year 7", "Year 8", ...].
   */
  yearGroups: string[];
  /**
   * Ordered list of column labels, e.g. ["Mon", "Tue", "Wed", "Thu", "Fri"].
   * Matches the column dimension of `matrix`.
   */
  columnLabels: string[];
  /**
   * matrix[yearGroupIndex][columnIndex] = incident count (integer ≥ 0).
   */
  matrix: number[][];
  /**
   * incidents[yearGroupIndex][columnIndex] = list of incidents for that cell.
   * When omitted, clicking cells will not show a popup.
   */
  incidents?: HeatmapCellIncident[][][];
  subtitle?: string;
  ctaHref?: string;
  ctaLabel?: string;
  hideCta?: boolean;
};

type SelectedCell = {
  yearGroup: string;
  columnLabel: string;
  value: number;
  incidents: HeatmapCellIncident[];
};

/** Map a value in [0, maxVal] to a coral opacity 0–1, clamped to [0.06, 0.88]. */
function coralOpacity(value: number, maxVal: number): number {
  if (maxVal === 0) return 0.06;
  const t = Math.min(value / maxVal, 1);
  // Use a gentle curve so low values still have a visible tint
  return 0.06 + t * 0.82;
}

/** Text colour — dark on light cells, white on dark cells */
function cellTextClass(opacity: number): string {
  return opacity > 0.52 ? "text-[#3d060b]" : "text-[var(--on-surface-variant)]";
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) +
    " · " +
    d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function statusPillClass(status: string): string {
  if (status === "OPEN") return "bg-[color-mix(in_srgb,var(--error)_12%,transparent)] text-[var(--error)]";
  if (status === "RESOLVED") return "bg-[color-mix(in_srgb,var(--success)_12%,transparent)] text-[var(--success)]";
  return "bg-[var(--surface-container)] text-muted";
}

function IncidentPopup({
  cell,
  onClose,
}: {
  cell: SelectedCell;
  onClose: () => void;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<Element | null>(null);

  useEffect(() => {
    previouslyFocused.current = document.activeElement;
    const t = window.setTimeout(() => {
      panelRef.current?.focus();
    }, 0);
    return () => {
      clearTimeout(t);
      const prev = previouslyFocused.current;
      if (prev instanceof HTMLElement) requestAnimationFrame(() => prev.focus());
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="presentation">
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-[var(--overlay)] calm-transition"
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
      />
      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative z-10 flex w-full max-w-lg flex-col rounded-2xl border border-[color-mix(in_srgb,var(--outline-variant)_55%,transparent)] bg-[var(--surface-container-lowest)] shadow-xl outline-none motion-safe:animate-page-enter"
        style={{ maxHeight: "min(90vh, 640px)" }}
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[color-mix(in_srgb,var(--outline-variant)_35%,transparent)] px-6 py-5">
          <div>
            <h2 id={titleId} className="text-base font-bold tracking-[-0.01em] text-text">
              {cell.yearGroup} · {cell.columnLabel}
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              {cell.value} incident{cell.value === 1 ? "" : "s"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-md p-1 text-muted calm-transition hover:bg-[var(--surface-container)] hover:text-text"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Incident list */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {cell.incidents.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted">No incident details available.</p>
          ) : (
            <ul className="divide-y divide-[color-mix(in_srgb,var(--outline-variant)_30%,transparent)]">
              {cell.incidents.map((inc) => (
                <li key={inc.id} className="px-6 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-text">{inc.studentName}</p>
                      <p className="mt-0.5 text-xs text-muted">{formatDateTime(inc.createdAt)}</p>
                    </div>
                    <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusPillClass(inc.status)}`}>
                      {inc.status}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
                    {inc.requesterName && (
                      <span>Called by <span className="font-medium text-text">{inc.requesterName}</span></span>
                    )}
                    {inc.location && (
                      <span>Location: <span className="font-medium text-text">{inc.location}</span></span>
                    )}
                    {inc.behaviourReasonCategory && (
                      <span>Reason: <span className="font-medium text-text">{inc.behaviourReasonCategory}</span></span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-[color-mix(in_srgb,var(--outline-variant)_35%,transparent)] px-6 py-4">
          <Link
            href="/on-call"
            className="text-xs font-semibold text-[var(--primary)] calm-transition hover:opacity-80"
            onClick={onClose}
          >
            View all on-call incidents →
          </Link>
        </div>
      </div>
    </div>
  );
}

export function BehaviourHeatmap({
  yearGroups,
  columnLabels,
  matrix,
  incidents,
  subtitle = "Disruption incidents by year group",
  ctaHref = "/students",
  ctaLabel = "View full map",
  hideCta = false,
}: BehaviourHeatmapProps) {
  const [hoverCell, setHoverCell] = useState<{
    yearGroup: string;
    columnLabel: string;
    value: number;
  } | null>(null);
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);

  const maxVal = useMemo(() => Math.max(...matrix.flatMap((row) => row), 1), [matrix]);

  const hasIncidents = incidents !== undefined;

  return (
    <div className="flex h-full flex-col gap-5">
      {/* Header */}
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--surface-container)] text-muted [&_svg]:h-4 [&_svg]:w-4">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-bold tracking-[-0.01em] text-text">Behaviour heatmap</h2>
            <p className="mt-0.5 text-xs text-muted">{subtitle}</p>
          </div>
        </div>
        {!hideCta ? (
          <Link
            href={ctaHref}
            className="shrink-0 text-xs font-semibold text-muted calm-transition hover:text-text"
          >
            View full map →
          </Link>
        ) : null}
      </div>

      <p className="text-[11px] font-medium text-muted">
        {hoverCell
          ? `${hoverCell.yearGroup} · ${hoverCell.columnLabel}: ${hoverCell.value} incident${hoverCell.value === 1 ? "" : "s"}`
          : hasIncidents
            ? "Click a cell to see incidents. Hover to preview."
            : "Hover a cell to inspect a specific day pattern."}
      </p>

      {/* Heatmap grid */}
      <div className="flex-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <table className="w-full min-w-[360px] border-collapse text-xs" aria-label="Behaviour heatmap by year group">
          <thead>
            <tr>
              {/* Empty corner */}
              <th scope="col" className="w-16 pb-2 pr-2 text-left" />
              {columnLabels.map((label, ci) => (
                <th
                  key={ci}
                  scope="col"
                  className="pb-2 text-center font-medium text-muted"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {yearGroups.map((yg, ri) => (
              <tr key={yg}>
                <th
                  scope="row"
                  className="py-1 pr-3 text-left text-[11px] font-medium text-muted"
                >
                  {yg}
                </th>
                {(matrix[ri] ?? []).map((val, ci) => {
                  const opacity = coralOpacity(val, maxVal);
                  const textClass = cellTextClass(opacity);
                  const isActive =
                    hoverCell?.yearGroup === yg && hoverCell?.columnLabel === columnLabels[ci];
                  const cellIncidents = incidents?.[ri]?.[ci] ?? [];
                  const clickable = hasIncidents && val > 0;
                  return (
                    <td key={ci} className="p-0.5">
                      <div
                        role={clickable ? "button" : undefined}
                        tabIndex={clickable ? 0 : undefined}
                        aria-label={clickable ? `${yg} ${columnLabels[ci]}: ${val} incident${val !== 1 ? "s" : ""}, click to view` : undefined}
                        className={`flex h-8 min-w-[2rem] items-center justify-center rounded-sm text-[11px] font-semibold tabular-nums transition-all duration-150 ${textClass} ${
                          isActive ? "scale-[1.04] ring-2 ring-[color-mix(in_srgb,var(--error)_22%,transparent)] shadow-none" : ""
                        } ${clickable ? "cursor-pointer" : ""}`}
                        style={{ background: `rgba(254,159,159,${Math.min(0.96, opacity + (isActive ? 0.08 : 0))})` }}
                        title={`${yg} — ${columnLabels[ci]}: ${val} incident${val !== 1 ? "s" : ""}${clickable ? " (click to view)" : ""}`}
                        onMouseEnter={() => setHoverCell({ yearGroup: yg, columnLabel: columnLabels[ci], value: val })}
                        onMouseLeave={() => setHoverCell((current) => (current?.yearGroup === yg && current?.columnLabel === columnLabels[ci] ? null : current))}
                        onClick={() => {
                          if (!clickable) return;
                          setSelectedCell({
                            yearGroup: yg,
                            columnLabel: columnLabels[ci],
                            value: val,
                            incidents: cellIncidents,
                          });
                        }}
                        onKeyDown={(e) => {
                          if (!clickable) return;
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedCell({
                              yearGroup: yg,
                              columnLabel: columnLabels[ci],
                              value: val,
                              incidents: cellIncidents,
                            });
                          }
                        }}
                      >
                        {val > 0 ? val : ""}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend + CTA row */}
      <div className="flex items-center justify-between gap-4">
        {/* Colour scale legend */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium text-muted">Low disruption</span>
          <div className="flex h-3 w-20 overflow-hidden rounded-sm">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="flex-1"
                style={{ background: `rgba(254,159,159,${0.06 + (i / 7) * 0.82})` }}
              />
            ))}
          </div>
          <span className="text-[10px] font-medium text-muted">High disruption</span>
        </div>

        {!hideCta ? (
          <Link
            href={ctaHref}
            className="shrink-0 text-sm font-semibold text-text calm-transition hover:text-muted"
          >
            {ctaLabel} →
          </Link>
        ) : null}
      </div>

      {/* Incident popup */}
      {selectedCell && (
        <IncidentPopup
          cell={selectedCell}
          onClose={() => setSelectedCell(null)}
        />
      )}
    </div>
  );
}
