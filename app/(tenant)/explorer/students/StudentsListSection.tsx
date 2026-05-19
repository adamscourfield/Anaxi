"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { StudentRiskRow, RiskBand } from "@/modules/analysis/studentRisk";
import {
  BAND_LABELS,
  formatDelta,
  studentDetailHref,
} from "@/modules/students/explorerList";
import { triangulationPpClass, triangulationSendClass } from "@/modules/assessments/attainmentColours";
import { bulkToggleWatchlist } from "@/app/(tenant)/analysis/students/actions";
import { WatchlistToggle } from "./WatchlistToggle";

function getInitials(name: string | null | undefined): string {
  const n = (name ?? "").trim();
  if (!n) return "—";
  const parts = n.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0][0];
    const b = parts[parts.length - 1][0];
    if (a && b) return (a + b).toUpperCase();
  }
  return n.substring(0, 2).toUpperCase();
}

function attendanceBarColor(pct: number | null): string {
  if (pct === null) return "bg-surface-container-high";
  if (pct >= 90) return "bg-scale-strong-bar";
  if (pct >= 80) return "bg-scale-some-bar";
  return "bg-scale-limited-bar";
}

function bandPillClass(band: RiskBand): string {
  switch (band) {
    case "URGENT":
      return "bg-[var(--pill-error-bg)] text-[var(--pill-error-text)] ring-1 ring-inset ring-[var(--pill-error-ring)]";
    case "PRIORITY":
      return "bg-[color-mix(in_srgb,var(--scale-limited-light)_88%,transparent)] text-[var(--scale-limited-text)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--scale-limited-bar)_22%,transparent)]";
    case "WATCH":
      return "bg-[var(--pill-warning-bg)] text-[var(--pill-warning-text)] ring-1 ring-inset ring-[var(--pill-warning-ring)]";
    case "STABLE":
      return "bg-[var(--pill-success-bg)] text-[var(--pill-success-text)] ring-1 ring-inset ring-[var(--pill-success-ring)]";
  }
}

function fmtDate(date: Date | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function deltaClass(value: number | null, invert = false): string {
  if (value === null) return "text-muted";
  if (value === 0) return "text-muted";
  const bad = invert ? value > 0 : value < 0;
  return bad ? "text-scale-limited-text" : "text-scale-strong-text";
}

type Props = {
  pageRows: StudentRiskRow[];
  windowDays: number;
  listPath: string;
  showBehaviourColumns: boolean;
  pageStart: number;
  pageEnd: number;
  totalFiltered: number;
  pagination: React.ReactNode;
};

export function StudentsListSection({
  pageRows,
  windowDays,
  listPath,
  showBehaviourColumns,
  pageStart,
  pageEnd,
  totalFiltered,
  pagination,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const allOnPageSelected =
    pageRows.length > 0 && pageRows.every((r) => selected.has(r.studentId));

  const toggleAll = () => {
    if (allOnPageSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pageRows.map((r) => r.studentId)));
    }
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runBulk = (add: boolean) => {
    const ids = [...selected];
    startTransition(async () => {
      await bulkToggleWatchlist(ids, add);
      setSelected(new Set());
    });
  };

  return (
    <div className="mt-4 table-shell">
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-b border-border/20 px-5 py-3">
          <span className="text-[0.8125rem] font-medium text-text">
            {selected.size} selected
          </span>
          <button
            type="button"
            disabled={pending}
            onClick={() => runBulk(true)}
            className="btn-filter-primary text-[0.8125rem]"
          >
            Add to watchlist
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => runBulk(false)}
            className="btn-filter-secondary text-[0.8125rem]"
          >
            Remove from watchlist
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-[0.8125rem] text-muted hover:text-text"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Mobile cards */}
      <div className="space-y-3 p-4 md:hidden">
        {pageRows.map((row) => {
          const href = studentDetailHref(row.studentId, windowDays, listPath);
          return (
            <Link
              key={row.studentId}
              href={href}
              className="block rounded-xl border border-border/30 bg-surface-container-lowest p-4 calm-transition hover:border-accent/40"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-container-low text-xs font-semibold">
                    {getInitials(row.studentName)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-text">{row.studentName}</p>
                    <p className="text-xs text-muted">{row.yearGroup ?? "—"}</p>
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${bandPillClass(row.band)}`}
                >
                  {BAND_LABELS[row.band]}
                </span>
              </div>
              {row.drivers.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {row.drivers.map((d) => (
                    <span
                      key={d.metric}
                      className="rounded-md bg-surface-container-low px-2 py-0.5 text-[10px] font-semibold text-muted"
                    >
                      {d.label}
                    </span>
                  ))}
                </div>
              )}
              {row.confidence === "LOW" && (
                <p className="mt-1 text-[10px] font-medium text-risk-priority-text">Low confidence</p>
              )}
              <div className="mt-3 flex flex-wrap gap-3 text-xs">
                <span className="tabular-nums">
                  Attendance{" "}
                  <strong className="text-text">
                    {row.attendancePct !== null ? `${Math.round(row.attendancePct)}%` : "—"}
                  </strong>
                </span>
                {showBehaviourColumns && (
                  <>
                    <span className={deltaClass(row.detentionsDelta, true)}>
                      Det Δ {formatDelta(row.detentionsDelta)}
                    </span>
                    <span className={deltaClass(row.onCallsDelta, true)}>
                      On-call Δ {formatDelta(row.onCallsDelta)}
                    </span>
                  </>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Desktop table */}
      <p className="sr-only" id="explorer-students-scroll-hint">
        This table scrolls horizontally on small screens.
      </p>
      <div
        className="hidden overflow-x-auto md:block"
        aria-describedby="explorer-students-scroll-hint"
      >
        <table className="w-full min-w-[880px] text-sm">
          <thead>
            <tr className="table-head-row text-left">
              <th className="w-10 px-3 py-3">
                <input
                  type="checkbox"
                  checked={allOnPageSelected}
                  onChange={toggleAll}
                  aria-label="Select all on page"
                  className="h-4 w-4 rounded border-border"
                />
              </th>
              <th className="w-10 px-2 py-3" aria-label="Watchlist" />
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Year</th>
              <th className="px-4 py-3">Why</th>
              <th className="px-4 py-3">Flags</th>
              <th className="px-4 py-3">Band</th>
              <th className="px-4 py-3">Attendance</th>
              {showBehaviourColumns && (
                <>
                  <th className="px-4 py-3 text-right">Det Δ</th>
                  <th className="px-4 py-3 text-right">On-call Δ</th>
                  <th className="px-4 py-3 text-right">Susp Δ</th>
                </>
              )}
              <th className="px-4 py-3">Updated</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => {
              const href = studentDetailHref(row.studentId, windowDays, listPath);
              return (
                <tr key={row.studentId} className="group table-row calm-transition">
                  <td className="px-3 py-4">
                    <input
                      type="checkbox"
                      checked={selected.has(row.studentId)}
                      onChange={() => toggleOne(row.studentId)}
                      aria-label={`Select ${row.studentName}`}
                      className="h-4 w-4 rounded border-border"
                    />
                  </td>
                  <td className="px-2 py-4">
                    <WatchlistToggle
                      studentId={row.studentId}
                      initialOnWatchlist={row.onWatchlist}
                    />
                  </td>
                  <td className="px-4 py-4">
                    <Link href={href} className="flex items-center gap-3 calm-transition hover:opacity-90">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-container-low text-xs font-semibold text-on-surface-variant">
                        {getInitials(row.studentName)}
                      </div>
                      <span className="font-medium text-text underline decoration-transparent underline-offset-2 group-hover:decoration-[color-mix(in_srgb,var(--outline-variant)_45%,transparent)]">
                        {row.studentName}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-4 text-muted">{row.yearGroup ?? "—"}</td>
                  <td className="px-4 py-4">
                    <div className="flex max-w-[200px] flex-wrap gap-1">
                      {row.drivers.length > 0 ? (
                        row.drivers.map((d) => (
                          <span
                            key={d.metric}
                            className="rounded-md bg-surface-container-low px-2 py-0.5 text-[10px] font-semibold text-muted"
                          >
                            {d.label}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-muted">No drivers</span>
                      )}
                      {row.confidence === "LOW" && (
                        <span className="rounded-md bg-risk-priority-bg px-2 py-0.5 text-[10px] font-semibold text-risk-priority-text">
                          Low conf.
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex gap-1.5">
                      {row.sendFlag && (
                        <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${triangulationSendClass}`}>
                          SEN
                        </span>
                      )}
                      {row.ppFlag && (
                        <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${triangulationPpClass}`}>
                          PP
                        </span>
                      )}
                      {!row.sendFlag && !row.ppFlag && (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex items-center rounded-md px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${bandPillClass(row.band)}`}
                    >
                      {BAND_LABELS[row.band]}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm tabular-nums text-text">
                        {row.attendancePct !== null
                          ? `${Math.round(row.attendancePct)}%`
                          : "—"}
                      </span>
                      {row.attendancePct !== null && (
                        <div className="h-2 w-16 overflow-hidden rounded-sm bg-[color-mix(in_srgb,var(--surface-container-high)_85%,transparent)]">
                          <div
                            className={`home-stat-bar-fill h-full rounded-sm ${attendanceBarColor(row.attendancePct)}`}
                            style={{
                              width: `${Math.min(100, Math.max(0, row.attendancePct))}%`,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </td>
                  {showBehaviourColumns && (
                    <>
                      <td className={`px-4 py-4 text-right tabular-nums text-sm font-medium ${deltaClass(row.detentionsDelta, true)}`}>
                        {formatDelta(row.detentionsDelta)}
                      </td>
                      <td className={`px-4 py-4 text-right tabular-nums text-sm font-medium ${deltaClass(row.onCallsDelta, true)}`}>
                        {formatDelta(row.onCallsDelta)}
                      </td>
                      <td className={`px-4 py-4 text-right tabular-nums text-sm font-medium ${deltaClass(row.suspensionsDelta, true)}`}>
                        {formatDelta(row.suspensionsDelta)}
                      </td>
                    </>
                  )}
                  <td className="px-4 py-4 text-muted">{fmtDate(row.lastSnapshotDate)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border/20 px-5 py-3.5">
        <p className="text-[0.8125rem] text-muted">
          Showing{" "}
          <span className="font-semibold text-text">
            {totalFiltered > 0 ? pageStart + 1 : 0}-{pageEnd}
          </span>{" "}
          of <span className="font-semibold text-text">{totalFiltered.toLocaleString()}</span>{" "}
          students
        </p>
        {pagination}
      </div>
    </div>
  );
}

